import {
  carregarDados, el, corSegura, urlSegura, versaoAtual, nomeSemMarca,
  formatarData, formatarTamanho, montarRodape,
} from "./dados.js";

const principal = document.getElementById("conteudo");

function mensagem(titulo, texto) {
  principal.replaceChildren(
    el("section", { class: "secao" },
      el("div", { class: "contido texto" },
        el("h2", { text: titulo }),
        el("p", { text: texto }),
        el("p", {}, el("a", { class: "botao", href: "./#programas", text: "Ver todos os programas" }))
      )
    )
  );
}

function painelDownload(programa, atual) {
  const caixa = el("aside", { class: "baixar", "aria-labelledby": "t-baixar" }, el("h2", { id: "t-baixar", text: "Download" }));
  if (!atual) {
    caixa.append(
      el("dl", {}, el("dt", { text: "Versão" }), el("dd", { text: "Aguardando publicação" })),
      el("button", { class: "botao grande", type: "button", disabled: true, text: "Download em breve" }),
      el("p", { class: "nota", text: "O instalador oficial ainda não foi publicado. Volte em breve ou fale com o suporte." })
    );
    return caixa;
  }
  const arq = atual.arquivo;
  const detalhes = el("dl", {}, el("dt", { text: "Versão" }), el("dd", { text: atual.versao }));
  if (formatarData(atual.data)) detalhes.append(el("dt", { text: "Publicada em" }), el("dd", { text: formatarData(atual.data) }));
  if (arq.nome) detalhes.append(el("dt", { text: "Arquivo" }), el("dd", { text: arq.nome }));
  if (formatarTamanho(arq.tamanho)) detalhes.append(el("dt", { text: "Tamanho" }), el("dd", { text: formatarTamanho(arq.tamanho) }));
  caixa.append(
    detalhes,
    el("a", { class: "botao grande", href: urlSegura(arq.url), rel: "noopener", text: `Baixar ${nomeSemMarca(programa.nome)}` }),
    el("p", { class: "nota", text: "Depois de baixar, extraia o ZIP e abra o instalador que está na pasta." })
  );
  if (/^[0-9a-fA-F]{64}$/.test(arq.sha256 || "")) {
    caixa.append(el("p", { class: "nota" }, "SHA-256 para conferência: ", el("code", { text: arq.sha256.toLowerCase() })));
  }
  return caixa;
}

function historico(programa, atual) {
  const versoes = programa.versoes || [];
  if (!versoes.length) return el("p", { class: "vazio", text: "Nenhuma versão publicada ainda. As atualizações vão aparecer aqui." });
  return el("ol", { class: "historico", reversed: true },
    versoes.map((v) => {
      const url = v.arquivo && urlSegura(v.arquivo.url);
      return el("li", {},
        el("div", {},
          el("div", { class: "versao", text: v.versao }),
          formatarData(v.data) && el("div", { class: "data", text: formatarData(v.data) }),
          v === atual && el("span", { class: "estado disponivel", text: "Versão atual" })
        ),
        el("div", {},
          (v.notas || []).length
            ? el("ul", {}, v.notas.map((n) => el("li", { text: n })))
            : el("p", { class: "data", text: "Sem anotações para esta versão." }),
          url && v !== atual && el("p", { class: "baixar-antiga" }, el("a", { href: url, rel: "noopener", text: `Baixar a versão ${v.versao}` }))
        )
      );
    })
  );
}

try {
  const dados = await carregarDados();
  montarRodape(dados, document.getElementById("rodape-links"));
  const id = new URLSearchParams(location.search).get("id");
  const programa = (dados.programas || []).find((p) => p.id === id && p.visivel !== false);

  if (!programa) {
    mensagem("Programa não encontrado", "O endereço pode estar incompleto ou o programa saiu do catálogo.");
  } else {
    const atual = versaoAtual(programa);
    document.title = `${programa.nome} — FND Sistemas`;
    const descricao = document.querySelector('meta[name="description"]');
    if (programa.resumo) descricao.setAttribute("content", `${programa.nome}: ${programa.resumo}`);
    document.documentElement.style.setProperty("--cor-programa", corSegura(programa.cor));

    const texto = el("div", { class: "texto" }, el("h2", { text: "O que é" }));
    texto.append(
      programa.descricao
        ? el("p", { text: programa.descricao })
        : el("p", { class: "vazio", text: "A apresentação deste programa está em preparação." })
    );
    if ((programa.recursos || []).length) {
      texto.append(el("h2", { text: "O que ele faz" }), el("ul", {}, programa.recursos.map((r) => el("li", { text: r }))));
    }
    if ((programa.requisitos || []).length) {
      texto.append(el("h2", { text: "Para usar, você precisa de" }), el("ul", {}, programa.requisitos.map((r) => el("li", { text: r }))));
    }

    principal.replaceChildren(
      el("section", { class: "capa" },
        el("div", { class: "contido" },
          el("a", { class: "voltar", href: "./#programas", text: "Todos os programas" }),
          el("h1", { "aria-label": programa.nome }, el("b", { text: "FND" }), nomeSemMarca(programa.nome)),
          programa.resumo && el("p", { class: "resumo", text: programa.resumo })
        )
      ),
      el("section", { class: "secao" }, el("div", { class: "contido duas-colunas" }, texto, painelDownload(programa, atual))),
      el("section", { class: "secao clara", "aria-labelledby": "t-historico" },
        el("div", { class: "contido" }, el("h2", { id: "t-historico", text: "Histórico de atualizações" }), historico(programa, atual))
      )
    );
  }
} catch (erro) {
  mensagem("Não foi possível abrir o programa", `${erro.message} Atualize a página; se continuar, tente de novo em alguns minutos.`);
}
