# Materiais comerciais

Três peças para a validação de mercado do Kidoo. Os arquivos finais estão nesta
pasta; os geradores ficam em `geradores/`, para que uma correção de texto ou de
preço não exija refazer o layout à mão.

| Arquivo | Para quem | Quando usar |
| --- | --- | --- |
| `Kidoo-proposta-parceiros.pptx` | Dono de academia, escolinha, clube | Reunião de apresentação, depois que o parceiro já demonstrou interesse |
| `Kidoo-pesquisa-estabelecimentos.docx` | O mesmo público | **Antes** da proposta — é entrevista, não venda |
| `Kidoo-pesquisa-familias.docx` | Pais e mães de crianças de 3 a 12 anos | Porta de escola, grupo de bairro, fila de atividade |

A ordem importa: as duas pesquisas existem para descobrir se a proposta do deck
se sustenta. Aplicar o deck antes da pesquisa contamina a resposta — quem acabou
de ouvir a apresentação não consegue mais responder sobre o próprio
comportamento sem repetir o que ouviu.

A última página de cada questionário é a orientação de quem aplica. **Não
entregue essa página junto com o formulário.**

## Regenerar

Os geradores dependem de `pptxgenjs` (deck) e `docx` (questionários), que não
são dependências do app — instale só na hora de gerar:

```bash
cd materiais/geradores
npm install --no-save pptxgenjs docx
node deck-parceiros.js     # escreve Kidoo-proposta-parceiros.pptx no diretório atual
node familias.js
node parceiros.js
```

Os números do deck saem de `R$ 8,00 por presença × 4,35 semanas por mês`
(slide 4). Se o repasse mudar, é `deck-parceiros.js` → `values: [70, 104, 139, 174]` e os
textos de `R$ 522` e `R$ 18,00` que precisam mudar junto.
