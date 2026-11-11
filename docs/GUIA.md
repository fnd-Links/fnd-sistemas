# Guia de uso — FND Sistemas

## 1. Entrar na área administrativa

1. Abra https://fnd-links.github.io/fnd-sistemas/admin/
2. Na primeira vez, crie um token no GitHub (a própria tela mostra o passo a passo):
   - Settings > Developer settings > Personal access tokens > Fine-grained tokens
   - Repository access: somente `fnd-Links/fnd-sistemas`
   - Permissions > Contents: Read and write
3. Cole o token e clique em Entrar.

O token fica guardado só no seu navegador. Sem um token válido da sua conta,
ninguém consegue alterar nada pelo painel.

## 2. Alterar as informações de um programa

1. Clique no programa na lista da esquerda.
2. Altere nome, resumo, descrição, recursos, requisitos ou cor.
3. Clique em **Publicar alterações**.

## 3. Publicar uma versão com o ZIP

1. No programa, clique em **Cadastrar nova versão**.
2. Preencha o número (ex.: `1.0.0`), a data e o que mudou.
3. Clique em **Criar rascunho da release**. O painel cria no GitHub um rascunho
   com a tag certa (ex.: `fnd-organiza-v1.0.0`).
4. Clique em **Abrir a release no GitHub**, edite o rascunho, arraste o ZIP
   do programa e clique em **Publish release**.
5. Volte ao painel e clique em **Buscar arquivo da release**. O link, o nome,
   o tamanho e o SHA-256 são preenchidos sozinhos.
6. Clique em **Publicar alterações**.

Enquanto uma versão não tem link de download, o portal mostra
"Download em breve" para aquele programa.

O envio do ZIP é feito na página do GitHub porque o GitHub não aceita upload
de arquivos de release direto de outro site pelo navegador.

## 4. Substituir uma versão antiga

Cadastre a versão nova (item 3). A versão mais recente com arquivo vira a
versão atual do portal; as anteriores continuam no histórico. Para tirar uma
versão do histórico, use **Remover esta versão**. Para apagar o ZIP, apague a
release na página de Releases do GitHub.

## 5. Adicionar um programa novo

1. Clique em **Adicionar programa** e digite o nome.
2. Preencha as informações e publique.

A página do programa passa a existir automaticamente em
`programa.html?id=<identificador>`.

## 6. Regras que o painel confere antes de publicar

- Identificadores únicos, só com letras minúsculas, números e hífen.
- Versões no formato `1.0.0`, sem repetição dentro do mesmo programa.
- Links de download sempre em `https://`.
- Um link de release deste repositório só é aceito na versão e no programa a
  que a tag pertence. Não dá para apontar o FND Controle de Acesso PRO para um
  ZIP do FND Vigia, nem o contrário.

## 7. Editar sem o painel

`data/programas.json` pode ser editado direto no GitHub. Depois de editar,
rode `node tests/validar.mjs` para conferir.
