# Painel de Rotas · Rondolog & Saster

Painel web de apoio à operação de transporte de cargas. Reúne em uma única página a consulta de rotas, a localização das bases, os pontos de coleta e entrega, o controle de checklist da frota e o acompanhamento de pesquisas cadastrais de veículos e condutores.

É um **projeto estático**, sem backend e sem dependência de servidor de aplicação. O HTML contém a estrutura da interface e carrega módulos JavaScript ES6+ de `src/`; não há etapa de build. Os dados de rotas e pontos vêm de arquivos JSON, e o que o usuário cadastra ou importa fica salvo no próprio navegador.

**Acesse:** [infofvalentim.github.io/buscador-operacoes-transporte](https://infofvalentim.github.io/buscador-operacoes-transporte)

---

## Funcionalidades

O painel é dividido em abas.

### 🚛 Rondolog e 📦 Saster: consulta de rotas

- Busca em tempo real por origem, destino, placa ou condutor, ignorando acentos e maiúsculas, com destaque do termo encontrado.
- Ordenação por padrão, origem (A-Z), destino (A-Z) e tipo.
- Filtro por tipo de operação (transferência, coleta e rota fixa), disponível na base Rondolog.
- **Favoritas:** marque rotas com a estrela e filtre só por elas.
- **Histórico de buscas:** guarda as últimas 8 buscas por base, com remoção individual.
- **Visão em matriz origem × destino:** mapa de calor com viagens e distância por par, totais por linha e coluna, e clique na célula para filtrar a lista.
- **Modo compacto** para listas longas e cópia do nome da rota com um clique no card.

### 🏭 Bases

- Cadastro embutido das bases operacionais (hubs, filiais e terminais) das duas empresas, com endereço, CEP e UF.
- Mapa interativo com [Leaflet](https://leafletjs.com/) e OpenStreetMap, com marcadores por tipo e popup com detalhes.
- Filtros por empresa, estado e tipo de base, mais busca por nome, cidade, endereço ou CEP.
- **Base mais próxima:** usa a geolocalização do navegador para ordenar as bases pela distância (fórmula de Haversine).
- Atalhos para Google Maps e Waze e botão para copiar o endereço.

### 📍 Pontos

- Lista de pontos de coleta, entrega e parada, carregada de `data/pontos.json`.
- Busca por nome, endereço, cidade ou CEP, filtro por UF e ordenação por frequência, nome ou UF.
- Indicadores de pontos únicos, rotas associadas, UFs e ponto mais frequente.
- Modal com as rotas que usam cada ponto e navegação direta para a rota na aba Rondolog.

### 🪪 Perfil

- Importação de planilha de **pesquisa cadastral** (`.xlsx`, `.xls` ou `.csv`) com colunas como _Item Pesquisado_, _Descrição_, _Tipo_, _Operação_, _Vigência_ e _Status_.
- Classificação automática em Cavalo/Caminhão, Leve/Utilitário, Carreta, Condutor e Ajudante.
- Visão geral com status (em acordo, análise vencida, pendente de documentação), resumo por categoria e próximos vencimentos.
- Telas separadas para veículos, carretas e condutores, com busca e filtros.

### 🚗 Frota

- Controle de checklist de veículos próprios, agregados e de terceiros, agrupado por categoria (cavalo, carreta, fiorino, leve e van), para que cavalo e carreta nunca se misturem nas contagens.
- Status calculado pela vigência: **vencido**, **urgente** (até 3 dias), **não OK** e **válido**, com dias de atraso nos vencidos.
- Importação do _Relatório Checklist_ em `.xlsx` (blocos "Veículo:" e "Carreta:" com dispositivos avaliados) ou de planilha tabular genérica. Em caso de placa duplicada, prevalece a checagem mais recente.
- Cadastro, edição e exclusão de veículos, filtros por status, tipo de frota e categoria.

### Geral

- Tema claro e escuro, com a preferência salva.
- Layout responsivo, pensado também para uso no celular.

---

## Tecnologias

- HTML5, CSS3 (variáveis CSS e temas) e JavaScript ES6+ com ES Modules, sem framework.
- [Leaflet 1.9.4](https://leafletjs.com/) local para mapas, com tiles do OpenStreetMap.
- [SheetJS 0.20.3](https://docs.sheetjs.com/docs/getting-started/installation/standalone/) local para leitura de planilhas no navegador.
- SHA-256 do arquivo `vendor/sheetjs/xlsx.full.min.js`: `CC015130AA8521E7F088F88898EBA949CCDCBFB38DF0BD129B44B7273C3A6F41`.
- Fontes Inter e Share Tech Mono locais.
- `localStorage` para favoritos, histórico, tema e dados importados.

Os arquivos de Leaflet, SheetJS e fontes ficam em `vendor/`, sem carregamento de bibliotecas por CDN. O mapa ainda carrega tiles do OpenStreetMap pela internet.

## Privacidade e dados pessoais

- **Não use dados reais neste repositório público.** Os arquivos em `data/*.json`, exemplos, fixtures e capturas versionadas devem conter somente dados fictícios.
- Antes de publicar alterações em `data/*.json`, execute `npm run check:pii`. O comando falha ao encontrar valores com formato de CPF e não imprime os valores encontrados.
- Planilhas importadas ficam somente no `localStorage` do navegador. CPFs do PERFIL são mascarados antes de serem armazenados; a aplicação não oferece exportação ou download dos dados.
- Dados importados são removidos automaticamente após **1 dia**. A aplicação avisa quando remove dados expirados. O prazo está definido em `DATA_RETENTION_DAYS` em `src/utils/retention.js`.
- O mapa consulta tiles do OpenStreetMap. Links para serviços externos de mapas só são abertos quando acionados pelo usuário.
- Uma política CSP restringe scripts, estilos, fontes e imagens aos recursos locais e aos tiles do OpenStreetMap; a política de referência é `no-referrer`.
- A política não usa `'unsafe-inline'` para scripts: os três módulos inline são autorizados por hash. `'unsafe-inline'` continua necessário somente para CSS inline, presente no bloco `<style>`, em atributos `style` e em estilos montados dinamicamente nos cards.
- Se o conteúdo de um dos módulos inline em `index.html` mudar, recalcule e atualize os hashes `sha256-...` na meta CSP.

---

## Estrutura do projeto

```
buscador-operacoes-transporte/
├── index.html            # estrutura da aplicação e estilos
├── package.json          # configuração de módulos e testes nativos do Node.js
├── src/
│   ├── components/
│   │   └── mapView.js     # encapsulamento do Leaflet e distâncias
│   ├── services/
│   │   └── dataService.js # carregamento e cache dos JSON estáticos
│   └── utils/
│       ├── checklistParser.js # parser puro dos formatos de checklist
│       ├── normalize.js       # normalização para busca sem acentos
│       ├── profileParser.js   # parser puro das planilhas cadastrais
│       └── retention.js      # prazo de retenção dos dados importados
├── vendor/                    # Leaflet, SheetJS e fontes locais
├── scripts/
│   └── check-pii.js           # verificação de CPFs em data/*.json
├── tests/                    # testes unitários dos módulos sem dependências externas
└── data/
    ├── rondolog.json     # rotas da Rondolog
    ├── saster.json       # rotas da Saster
    ├── pontos.json       # pontos de coleta, entrega e parada
    ├── checklists.json  # opcional: carga inicial legada da aba Frota
    └── destinos.json    # arquivo legado, não carregado pela aplicação atual
```

As interfaces de Frota e Perfil ainda estão embutidas no `index.html`; seus parsers de planilha e o componente de mapa estão extraídos em módulos. As bases operacionais também ficam no HTML (constante `BASES`). Para incluir ou alterar uma base, edite essa lista.

---

## Formato dos dados

### `data/rondolog.json` e `data/saster.json`

Lista de rotas. O campo `origem` e o campo `destino` devem estar no formato `Cidade/UF`, pois a matriz usa o texto antes da barra como rótulo.

```json
[
  {
    "nome_da_rota": "EXEMPLO - ORIGEM x DESTINO",
    "origem": "Duque de Caxias/RJ",
    "destino": "Santana de Parnaíba/SP",
    "tipo": "transferencia",
    "viagens": 12,
    "distancia_km": 450,
    "condutores": ["NOME SOBRENOME"],
    "placas": ["ABC1D23"]
  }
]
```

| Campo                      | Descrição                                                    |
| -------------------------- | ------------------------------------------------------------ |
| `nome_da_rota` (ou `nome`) | Nome exibido e copiado no card                               |
| `origem`, `destino`        | Cidade/UF                                                    |
| `tipo`                     | `transferencia`, `coleta` ou `rota` (usado na base Rondolog) |
| `viagens`                  | Quantidade de viagens, usada na matriz e no card             |
| `distancia_km`             | Distância exibida na matriz                                  |
| `condutores`, `placas`     | Listas exibidas nos cards e consideradas na busca            |

### `data/pontos.json`

```json
[
  {
    "nome": "CLIENTE EXEMPLO",
    "endereco": "Rua Exemplo, 100 - Bairro",
    "cidade": "Campinas",
    "uf": "SP",
    "cep": "13000-000",
    "count": 5,
    "rotas": ["EXEMPLO - ORIGEM x DESTINO"]
  }
]
```

`count` é a quantidade de rotas associadas e define a ordenação por frequência. Os itens de `rotas` devem corresponder a `nome_da_rota` para a navegação entre abas funcionar.

---

## Como executar localmente

O painel carrega os JSON com `fetch`, que não funciona abrindo o arquivo direto no navegador (`file://`). Use um servidor local simples:

```bash
git clone https://github.com/infofvalentim/buscador-operacoes-transporte.git
cd buscador-operacoes-transporte
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

Para executar os testes unitários dos módulos:

```bash
npm test
npm run check:pii
```

## Publicação

O projeto está pronto para o **GitHub Pages**: em _Settings → Pages_, selecione a branch principal e a pasta raiz. Não há etapa de build.

---

## Armazenamento no navegador

Os dados cadastrados ou importados nas abas Perfil e Frota, assim como favoritos, histórico, tema e modo compacto, ficam apenas no `localStorage` do navegador de quem usa; planilhas não são enviadas a um backend. O mapa carrega tiles do OpenStreetMap, e os links externos só são abertos por ação do usuário. Cada usuário e dispositivo tem sua própria cópia local.

| Chave                              | Conteúdo                           |
| ---------------------------------- | ---------------------------------- |
| `rondologFavorites`                | Rotas favoritas por base           |
| `rondologHistory`                  | Histórico de buscas por base       |
| `rondologTheme`, `rondologCompact` | Tema e modo compacto               |
| `frotaChecklistData_v1`            | Veículos da aba Frota              |
| `frotaSmUsage_v1`                  | Saídas de S.M. importadas           |
| `perfilCadastralData_v1`           | Registros importados na aba Perfil |

As importações recebem `importadoEm` e são removidas automaticamente após um dia. O CPF do PERFIL é mascarado antes de ser persistido.

## Dados e privacidade

Este repositório é público: tudo o que estiver versionado fica acessível a qualquer pessoa. **Só são aceitos dados fictícios** em `data/`, exemplos, fixtures e capturas; não publique dados reais ou anonimizados da operação.

`npm run check:pii` procura valores com formato de CPF em `data/*.json` e retorna erro se encontrar algum. A checagem é uma proteção adicional, não substitui a revisão manual de dados pessoais.

---

## Autor

**Felipe Valentim**, Analista de Gerenciamento de Riscos | BI Logístico

[LinkedIn](https://linkedin.com/in/felipevalentiim) · [GitHub](https://github.com/infofvalentim)
