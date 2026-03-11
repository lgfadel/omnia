#!/bin/bash

# Lista de CNPJs para atualizar
CNPJS=(
  "02395783000185:a3eb79aa-1f30-4c5c-9a64-8d049df1b4a7"
  "43932522000134:812919b5-3f27-46fa-b657-e53c86686275"
  "62023594000103:da258c53-f332-4d6c-91c6-3fed31593715"
  "07150494000130:7987a2ad-514c-45c6-8fce-8565660545c6"
  "49799842000144:e72d2318-8b7e-43c5-ba1a-22352c2ae9d7"
  "10234155000146:00e5f3d8-7913-43d7-be20-1924382b7d62"
  "10276841000180:a03a4f20-8c74-4ce7-9f8a-4c91ba9e5805"
  "21410619000144:965c1164-4b2f-4cbf-b782-8e094e1138ee"
  "63785642000163:5f5b48d4-b4e1-4b71-b661-d0a8c6b216d2"
  "50832997000114:daa560cf-7eab-4721-8013-d61857c6f88f"
  "42523437000150:752c5d18-8466-47b5-ad0d-7093a68e3a25"
  "78963097000125:f1464750-e0d0-4030-a7fa-33ce90d0042d"
  "20442152000151:384f27a6-a8da-41be-a84d-fbb9e7b1bbc5"
  "81759508000170:9be5af76-f325-47bf-b683-1b10ec87ab68"
  "78971363000161:f1b8d6f4-c4db-47fe-8344-1702611c8069"
  "04954651000171:1484f7ae-d62b-42c2-b2d5-65b87bf89676"
  "26312212000106:a7aeeb33-74d7-4629-918f-026ec5e60434"
  "23272344000155:e0d5778a-eda0-42ce-8a2a-a885a85ebb04"
  "05317824000103:268e5094-dcc8-4250-a834-5f8b3d90407e"
  "23855585000127:04241cc6-9edd-47f5-8ea9-d9d309c87b87"
  "28224382000156:af77b757-7bfd-441c-9aaa-5952556708f9"
  "04398092000160:a76dcab7-a85b-4079-80b1-ae68dbfa5cdd"
  "20248194000156:059b0536-c783-4947-9377-74900c311914"
  "07499986000135:62c54c10-4433-4b91-a65b-b29736438d5f"
  "26390805000182:36927a67-dcd2-4ed7-a1b9-9d99dee0effa"
  "81757981000118:13e42e6f-90b2-49cf-b2c7-bdb3d0e9e343"
  "80924145000118:39b2f178-cf18-4de6-aca8-f6381542194d"
  "60938033000109:2911c912-e47f-4eb9-b7f6-af1501eb14af"
  "27454873000120:82518fa8-2567-4bcd-b1a9-4d14bc8ac924"
  "12523639000130:e787fd1f-0d83-447d-9dbe-97a00fa216fe"
  "12861414000194:29f5e260-56fa-4bfc-8be0-111552d34324"
  "58035886000199:e767d590-20aa-49ad-85b5-2ed7877c3077"
  "21570509000140:d261faa4-4b29-4bbe-a58b-58184ee9e979"
  "29021167000110:9f934c35-9d0e-44fc-8555-783894083273"
  "05245930000129:a1316be2-c98f-4cd8-87c9-cab25a0933c7"
  "17851753000103:dd4b1045-3ef2-4608-ac1f-6c66d66a4e61"
  "20667202000107:8470c6eb-03bc-415e-92b8-c706b850c50e"
  "23454198000189:44fc9009-15ff-417d-8a46-5ca16447b253"
  "51237413000125:e7afd4f0-9039-4af6-9d06-836dec71770f"
  "23915074000153:0ae0ac4b-b0e0-4c36-a0c5-65d055954bc2"
  "37337833000152:1fee5e6e-9171-4c43-95c6-af4e5a4a7673"
  "27770737000140:16c52fad-fa52-49b3-b630-6e5fca914485"
  "54128716000106:0136d3cf-da9e-40dd-b70a-4e7d8495be45"
  "21059887000163:7ff71cde-c393-4914-bb4f-35a4d595fd90"
  "19294613000107:9e6534cb-0d2d-40c1-8337-a6208e0d5d7d"
  "48530486000104:ab5bc5a5-2dbf-4f8b-a011-c9b317ba985d"
  "27323207000153:81323e20-92fb-466b-b7b4-cd519c6196ec"
  "47569591000186:2a5277f6-40d1-4916-8db4-9e70faa9256b"
  "31999104000185:ef9f510e-3d12-41e1-8f41-a3d39f1c5b22"
  "61698450000194:57e144a1-a361-4ef7-b909-25105da1c75b"
)

for item in "${CNPJS[@]}"; do
  CNPJ="${item%%:*}"
  ID="${item##*:}"
  
  echo "Buscando CNPJ: $CNPJ"
  
  DATA=$(curl -s "https://brasilapi.com.br/api/cnpj/v1/$CNPJ")
  
  if [ $? -eq 0 ] && [ -n "$DATA" ]; then
    STREET=$(echo "$DATA" | jq -r '.logradouro // empty')
    NUMBER=$(echo "$DATA" | jq -r '.numero // empty')
    COMPLEMENT=$(echo "$DATA" | jq -r '.complemento // empty')
    NEIGHBORHOOD=$(echo "$DATA" | jq -r '.bairro // empty')
    CITY=$(echo "$DATA" | jq -r '.municipio // empty')
    STATE=$(echo "$DATA" | jq -r '.uf // empty')
    ZIP_CODE=$(echo "$DATA" | jq -r '.cep // empty' | tr -d '.-')
    PHONE=$(echo "$DATA" | jq -r '.ddd_telefone_1 // empty' | tr -d ' ()-')
    
    echo "  -> $CITY/$STATE - $STREET, $NUMBER"
    
    # Gera SQL
    echo "UPDATE omnia_condominiums SET street='$STREET', number='$NUMBER', complement='$COMPLEMENT', neighborhood='$NEIGHBORHOOD', city='$CITY', state='$STATE', zip_code='$ZIP_CODE', phone='$PHONE' WHERE id='$ID';" >> /tmp/update_condominiums.sql
  else
    echo "  -> ERRO ao buscar"
  fi
  
  sleep 0.5
done

echo ""
echo "SQL gerado em /tmp/update_condominiums.sql"
