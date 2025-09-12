#!/bin/bash

# Script para corrigir todos os imports de @/data/fixtures para @/data/types
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|@/data/fixtures|@/data/types|g'

echo "Imports corrigidos!"