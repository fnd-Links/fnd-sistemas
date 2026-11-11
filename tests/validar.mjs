// Confere o catálogo e os arquivos do site. Uso: node tests/validar.mjs
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (caminho) => readFileSync(join(raiz, caminho), "utf8");
const problemas = [];

// dados.js usa import.meta.url e document só dentro de funções; dá para importar no Node.
const { validarCatalogo, versaoAtual } = await import(join(raiz, "assets/js/dados.js"));
const { URL_REPOSITORIO } = await import(join(raiz, "assets/js/config.js"));

const dados = JSON.parse(ler("data/programas.json"));
problemas.push(...validarCatalogo(dados, `${URL_REPOSITORIO}/releases/download/`));

// Arquivos locais citados nas páginas precisam existir.
for (const pagina of ["index.html", "programa.html", "admin/index.html"]) {
  const html = ler(pagina);
  const pasta = dirname(pagina);
  for (const [, alvo] of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
    if (/^(https?:|mailto:)/.test(alvo) || alvo === "./" || alvo === "../") continue;
    if (!existsSync(join(raiz, pasta, alvo))) problemas.push(`${pagina}: arquivo não encontrado: ${alvo}`);
  }
}

for (const p of dados.programas) {
  const atual = versaoAtual(p);
  console.log(`${p.nome.padEnd(30)} ${atual ? `versão ${atual.versao}` : "sem download publicado"}`);
}

if (problemas.length) {
  console.error("\nProblemas encontrados:");
  for (const p of problemas) console.error(` - ${p}`);
  process.exit(1);
}
console.log("\nCatálogo e arquivos conferidos: tudo certo.");
