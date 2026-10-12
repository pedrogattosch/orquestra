# Teste do instalador do Windows, rodado pelo workflow "Instalador Windows" depois do build.
# Instala o .exe em modo silencioso, abre o app, abre terminais pela API e pelo orquestra-abrir,
# confere a restauração ao reabrir e desinstala. Não cobre a janela, a bandeja, o VS Code nem notificações.
param([Parameter(Mandatory)][string]$Instalador)

$ErrorActionPreference = 'Stop'

$pastaApp = Join-Path $env:LOCALAPPDATA 'Programs\Orquestra'
$exe = Join-Path $pastaApp 'Orquestra.exe'
$dados = Join-Path $env:APPDATA 'Orquestra'
$atalhos = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Orquestra.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Orquestra.lnk')
)

function Confirmar([bool]$ok, [string]$mensagem) {
  if (-not $ok) { throw "FALHOU: $mensagem" }
  Write-Host "ok: $mensagem"
}

# O instalador e o desinstalador do NSIS podem terminar antes de concluir o trabalho; espera a condição.
function Esperar([scriptblock]$condicao, [string]$mensagem, [int]$segundos = 60) {
  $fim = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $fim) {
    if (& $condicao) { Write-Host "ok: $mensagem"; return }
    Start-Sleep -Seconds 1
  }
  throw "FALHOU: $mensagem (esperou $segundos s)"
}

function EntradaDesinstalar {
  Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'Orquestra*' }
}

# Abre o app e devolve o endereço do servidor local (porta aleatória em 127.0.0.1).
function Abrir {
  $proc = Start-Process $exe -PassThru
  $script:url = $null
  Esperar {
    $ids = @(Get-Process Orquestra -ErrorAction SilentlyContinue | ForEach-Object Id)
    $porta = Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -ErrorAction SilentlyContinue |
      Where-Object { $ids -contains $_.OwningProcess } | Select-Object -First 1 -ExpandProperty LocalPort
    if ($porta) { $script:url = "http://127.0.0.1:$porta" }
    [bool]$porta
  } 'o app abre e o servidor local responde'
  Confirmar (-not $proc.HasExited) 'o processo do app continua rodando'
  return $script:url
}

function Fechar {
  Stop-Process -Name Orquestra -Force -ErrorAction SilentlyContinue
  Esperar { -not (Get-Process Orquestra -ErrorAction SilentlyContinue) } 'o app fecha'
}

function Estado([string]$url) { Invoke-RestMethod "$url/api/state" }

# ---------------------------------------------------------------- instalação
Confirmar (-not (Test-Path $exe)) 'o Orquestra ainda não está instalado'
Start-Process $Instalador -ArgumentList '/S' -Wait
Esperar { Test-Path $exe } "o app é instalado em $pastaApp"
foreach ($a in $atalhos) { Esperar { Test-Path $a } "o atalho $a existe" }
Confirmar ([bool](EntradaDesinstalar)) 'o app aparece em Aplicativos instalados'

# ---------------------------------------------------------------- terminais
$url = Abrir
$sessao = (Estado $url).activeSession
$terminal = Invoke-RestMethod "$url/api/terminals" -Method Post -ContentType 'application/json' `
  -Body (@{ dir = $env:USERPROFILE; sessionId = $sessao } | ConvertTo-Json)
Start-Sleep -Seconds 3
Confirmar ((Estado $url).live.($terminal.id) -eq $true) 'um terminal novo abre o PowerShell e continua vivo'

$env:ORQUESTRA_URL = $url
$env:ORQUESTRA_TERMINAL_ID = $terminal.id
$env:ORQUESTRA_NODE = $exe
& (Join-Path $pastaApp 'resources\bin\orquestra-abrir.cmd') --pasta $env:USERPROFILE --nome 'filho'
Confirmar ($LASTEXITCODE -eq 0) 'o orquestra-abrir roda com o executável do app'
$terminais = (Estado $url).sessions | Where-Object id -eq $sessao | ForEach-Object terminals
Confirmar (@($terminais).Count -eq 2) 'o orquestra-abrir abre um segundo terminal na mesma sessão'

Start-Sleep -Seconds 1 # o estado é salvo em disco 300 ms depois de cada mudança
Fechar
Confirmar (Test-Path (Join-Path $dados 'estado.json')) "as sessões são salvas em $dados"

# ---------------------------------------------------------------- restauração
$url = Abrir
Start-Sleep -Seconds 3
Confirmar ((Estado $url).live.($terminal.id) -eq $true) 'ao abrir de novo, o terminal é restaurado'
Fechar

# ---------------------------------------------------------------- desinstalação
$desinstalador = Join-Path $pastaApp 'Uninstall Orquestra.exe'
Start-Process $desinstalador -ArgumentList '/S' -Wait
Esperar { -not (Test-Path $exe) } 'a desinstalação remove o app'
foreach ($a in $atalhos) { Esperar { -not (Test-Path $a) } "a desinstalação remove o atalho $a" }
Esperar { -not (EntradaDesinstalar) } 'a desinstalação tira o app de Aplicativos instalados'
Esperar { -not (Test-Path $dados) } 'a desinstalação apaga as sessões salvas'

Write-Host 'Instalador do Windows: todos os testes passaram.'
