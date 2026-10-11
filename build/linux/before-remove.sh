#!/bin/bash
# Não deixa desinstalar enquanto o Orquestra estiver aberto (os agentes seriam encerrados sem aviso).
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
  if pgrep -f '/opt/Orquestra/orquestra' > /dev/null 2>&1; then
    echo "O Orquestra está aberto. Saia dele (menu Sair) e rode a desinstalação de novo." >&2
    exit 1
  fi
fi
