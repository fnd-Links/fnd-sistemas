# FND Sistemas

Central oficial de downloads e suporte dos programas FND Sistemas.

Portal: https://fnd-links.github.io/fnd-sistemas/
Área administrativa: https://fnd-links.github.io/fnd-sistemas/admin/

## Programas

- FND Remoto Central
- FND Controle de Acesso
- FND Controle de Acesso PRO
- FND Vigia
- FND Otimizador PRO
- FND Organiza

## Como o projeto funciona

| Parte | Onde fica |
| --- | --- |
| Página inicial | `index.html` |
| Página de cada programa | `programa.html?id=<identificador>` |
| Catálogo (nomes, textos, versões, links) | `data/programas.json` |
| Área administrativa | `admin/` |
| Arquivos ZIP dos programas | GitHub Releases, uma release por versão de cada programa |

O site é estático (GitHub Pages). Tudo o que aparece nas páginas vem de
`data/programas.json`. A área administrativa edita esse arquivo pelo navegador
e grava no repositório; o portal se atualiza sozinho em cerca de um minuto.

Os ZIPs não ficam dentro do repositório. Cada versão de cada programa tem a
própria release, com a tag `<identificador>-v<versão>`, por exemplo
`fnd-organiza-v1.0.0`. Assim os arquivos de um programa nunca se misturam com
os de outro.

O passo a passo para publicar versões, trocar textos e adicionar programas
está em [docs/GUIA.md](docs/GUIA.md).

## Conferir o catálogo

```
node tests/validar.mjs
```
