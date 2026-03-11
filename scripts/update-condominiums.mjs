// Script para buscar dados de CNPJ e gerar SQL de update

const condominiums = [
  { id: "a3eb79aa-1f30-4c5c-9a64-8d049df1b4a7", cnpj: "02395783000185" },
  { id: "812919b5-3f27-46fa-b657-e53c86686275", cnpj: "43932522000134" },
  { id: "da258c53-f332-4d6c-91c6-3fed31593715", cnpj: "62023594000103" },
  { id: "7987a2ad-514c-45c6-8fce-8565660545c6", cnpj: "07150494000130" },
  { id: "e72d2318-8b7e-43c5-ba1a-22352c2ae9d7", cnpj: "49799842000144" },
  { id: "00e5f3d8-7913-43d7-be20-1924382b7d62", cnpj: "10234155000146" },
  { id: "a03a4f20-8c74-4ce7-9f8a-4c91ba9e5805", cnpj: "10276841000180" },
  { id: "965c1164-4b2f-4cbf-b782-8e094e1138ee", cnpj: "21410619000144" },
  { id: "5f5b48d4-b4e1-4b71-b661-d0a8c6b216d2", cnpj: "63785642000163" },
  { id: "daa560cf-7eab-4721-8013-d61857c6f88f", cnpj: "50832997000114" },
  { id: "752c5d18-8466-47b5-ad0d-7093a68e3a25", cnpj: "42523437000150" },
  { id: "f1464750-e0d0-4030-a7fa-33ce90d0042d", cnpj: "78963097000125" },
  { id: "384f27a6-a8da-41be-a84d-fbb9e7b1bbc5", cnpj: "20442152000151" },
  { id: "9be5af76-f325-47bf-b683-1b10ec87ab68", cnpj: "81759508000170" },
  { id: "f1b8d6f4-c4db-47fe-8344-1702611c8069", cnpj: "78971363000161" },
  { id: "1484f7ae-d62b-42c2-b2d5-65b87bf89676", cnpj: "04954651000171" },
  { id: "a7aeeb33-74d7-4629-918f-026ec5e60434", cnpj: "26312212000106" },
  { id: "e0d5778a-eda0-42ce-8a2a-a885a85ebb04", cnpj: "23272344000155" },
  { id: "268e5094-dcc8-4250-a834-5f8b3d90407e", cnpj: "05317824000103" },
  { id: "04241cc6-9edd-47f5-8ea9-d9d309c87b87", cnpj: "23855585000127" },
  { id: "af77b757-7bfd-441c-9aaa-5952556708f9", cnpj: "28224382000156" },
  { id: "a76dcab7-a85b-4079-80b1-ae68dbfa5cdd", cnpj: "04398092000160" },
  { id: "059b0536-c783-4947-9377-74900c311914", cnpj: "20248194000156" },
  { id: "62c54c10-4433-4b91-a65b-b29736438d5f", cnpj: "07499986000135" },
  { id: "36927a67-dcd2-4ed7-a1b9-9d99dee0effa", cnpj: "26390805000182" },
  { id: "13e42e6f-90b2-49cf-b2c7-bdb3d0e9e343", cnpj: "81757981000118" },
  { id: "39b2f178-cf18-4de6-aca8-f6381542194d", cnpj: "80924145000118" },
  { id: "2911c912-e47f-4eb9-b7f6-af1501eb14af", cnpj: "60938033000109" },
  { id: "82518fa8-2567-4bcd-b1a9-4d14bc8ac924", cnpj: "27454873000120" },
  { id: "e787fd1f-0d83-447d-9dbe-97a00fa216fe", cnpj: "12523639000130" },
  { id: "29f5e260-56fa-4bfc-8be0-111552d34324", cnpj: "12861414000194" },
  { id: "e767d590-20aa-49ad-85b5-2ed7877c3077", cnpj: "58035886000199" },
  { id: "d261faa4-4b29-4bbe-a58b-58184ee9e979", cnpj: "21570509000140" },
  { id: "9f934c35-9d0e-44fc-8555-783894083273", cnpj: "29021167000110" },
  { id: "a1316be2-c98f-4cd8-87c9-cab25a0933c7", cnpj: "05245930000129" },
  { id: "dd4b1045-3ef2-4608-ac1f-6c66d66a4e61", cnpj: "17851753000103" },
  { id: "8470c6eb-03bc-415e-92b8-c706b850c50e", cnpj: "20667202000107" },
  { id: "44fc9009-15ff-417d-8a46-5ca16447b253", cnpj: "23454198000189" },
  { id: "e7afd4f0-9039-4af6-9d06-836dec71770f", cnpj: "51237413000125" },
  { id: "0ae0ac4b-b0e0-4c36-a0c5-65d055954bc2", cnpj: "23915074000153" },
  { id: "1fee5e6e-9171-4c43-95c6-af4e5a4a7673", cnpj: "37337833000152" },
  { id: "16c52fad-fa52-49b3-b630-6e5fca914485", cnpj: "27770737000140" },
  { id: "0136d3cf-da9e-40dd-b70a-4e7d8495be45", cnpj: "54128716000106" },
  { id: "7ff71cde-c393-4914-bb4f-35a4d595fd90", cnpj: "21059887000163" },
  { id: "9e6534cb-0d2d-40c1-8337-a6208e0d5d7d", cnpj: "19294613000107" },
  { id: "ab5bc5a5-2dbf-4f8b-a011-c9b317ba985d", cnpj: "48530486000104" },
  { id: "81323e20-92fb-466b-b7b4-cd519c6196ec", cnpj: "27323207000153" },
  { id: "2a5277f6-40d1-4916-8db4-9e70faa9256b", cnpj: "47569591000186" },
  { id: "ef9f510e-3d12-41e1-8f41-a3d39f1c5b22", cnpj: "31999104000185" },
  { id: "57e144a1-a361-4ef7-b909-25105da1c75b", cnpj: "61698450000194" },
];

const escape = (str) => str ? str.replace(/'/g, "''") : '';

async function fetchCNPJ(cnpj) {
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const sqls = [];
  
  for (const cond of condominiums) {
    console.log(`Buscando ${cond.cnpj}...`);
    const data = await fetchCNPJ(cond.cnpj);
    
    if (data) {
      const street = escape(data.logradouro || '');
      const number = escape(data.numero || '');
      const complement = escape(data.complemento || '');
      const neighborhood = escape(data.bairro || '');
      const city = escape(data.municipio || '');
      const state = escape(data.uf || '');
      const zipCode = (data.cep || '').replace(/\D/g, '');
      const phone = (data.ddd_telefone_1 || '').replace(/\D/g, '');
      
      sqls.push(`UPDATE omnia_condominiums SET street='${street}', number='${number}', complement='${complement}', neighborhood='${neighborhood}', city='${city}', state='${state}', zip_code='${zipCode}', phone='${phone}' WHERE id='${cond.id}';`);
      console.log(`  -> ${city}/${state}`);
    } else {
      console.log(`  -> ERRO`);
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n--- SQL ---\n');
  console.log(sqls.join('\n'));
}

main();
