import { carregarDados, el, corSegura, versaoAtual, nomeSemMarca, montarRodape } from "./dados.js";

const lista = document.getElementById("lista-programas");

function linhaPrograma(programa) {
  const atual = versaoAtual(programa);
  const endereco = `programa.html?id=${encodeURIComponent(programa.id)}`;
  const linha = el(
    "li",
    { class: "programa-linha", style: `--cor-programa:${corSegura(programa.cor)}` },
    el("h3", {}, el("a", { href: endereco, text: programa.nome })),
    el("p", { class: "resumo", text: programa.resumo || "Apresentação em preparação." }),
    el(
      "div",
      { class: "lado" },
      atual
        ? el("span", { class: "estado disponivel", text: `Versão ${atual.versao}` })
        : el("span", { class: "estado em-breve", text: "Download em breve" }),
      el("a", { class: "botao secundario pequeno", href: endereco, text: atual ? "Ver e baixar" : "Ver programa" })
    )
  );
  return linha;
}

try {
  const dados = await carregarDados();
  const visiveis = (dados.programas || []).filter((p) => p.visivel !== false);

  if (dados.portal && dados.portal.frase) document.getElementById("frase").textContent = dados.portal.frase;

  document.getElementById("indice").replaceChildren(
    ...visiveis.map((p) =>
      el("li", {}, el("a", { href: `programa.html?id=${encodeURIComponent(p.id)}`, "aria-label": p.nome, text: nomeSemMarca(p.nome) }))
    )
  );

  lista.replaceChildren(
    ...(visiveis.length ? visiveis.map(linhaPrograma) : [el("li", { class: "vazio", text: "Nenhum programa publicado ainda." })])
  );

  const destino = document.getElementById("contatos");
  if (!montarRodape(dados, destino)) destino.replaceChildren(el("p", { class: "vazio", text: "Canais de contato em breve." }));
} catch (erro) {
  lista.replaceChildren(
    el("li", { class: "aviso erro", text: `${erro.message} Atualize a página; se continuar, tente de novo em alguns minutos.` })
  );
}
