const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  Header, Footer, PageNumber,
} = require("docx");

const PAGE_W = 11906; // A4 largura em DXA
const PAGE_H = 16838; // A4 altura em DXA
const MARGIN = 1417; // 2.5cm

function p(text, opts = {}) {
  const { bold, italic, size = 22, alignment = AlignmentType.JUSTIFIED, spacingAfter = 200, spacingBefore = 0 } = opts;
  return new Paragraph({
    alignment,
    spacing: { after: spacingAfter, before: spacingBefore, line: 360 },
    children: [
      new TextRun({ text, bold, italic, size }),
    ],
  });
}

function mixed(runs, opts = {}) {
  const { alignment = AlignmentType.JUSTIFIED, spacingAfter = 200, spacingBefore = 0 } = opts;
  return new Paragraph({
    alignment,
    spacing: { after: spacingAfter, before: spacingBefore, line: 360 },
    children: runs.map(r => new TextRun({ size: 22, ...r })),
  });
}

const modulos = [
  "Administração de Contratos (Preços) — Cadastro de Convênios, Preços e Regras, Tabelas de Preços",
  "Agenda — Consultas, Exames, Serviços e Gestão da Agenda Cirúrgica",
  "Almoxarifado e Estoque — Requisição de Materiais, Notas Fiscais, Controle de Transferências",
  "Auditoria — Auditoria de Conta Paciente",
  "Cadastros e Funções Gerais — Cadastro Médico, Estrutura de Atendimento, Pessoa Física/Jurídica",
  "Centro Cirúrgico — Gestão de Cirurgias",
  "Compras — Cotação, Ordem e Solicitação de Compra",
  "Contas a Pagar e a Receber — Títulos, Borderôs, Adiantamentos",
  "Controle de Infecção Hospitalar (CCIH) — Notificação e Investigação",
  "Enfermagem — Administração Eletrônica da Prescrição (ADEP)",
  "Exames — Central de Laudos, Gestão de Exames e Laudo Paciente",
  "Farmácia — Dispensação, Execução de Prescrição, Prescrição de Emergência",
  "Faturamento (Convênios e Particular) — Conta Paciente, Protocolo Convênio",
  "Prescrição Eletrônica (CPOE) e Prontuário Eletrônico do Paciente (PEP)",
  "Recepção e Internação — Cadastro de Pacientes, Movimentação, Ocupação Hospitalar",
  "SUS — AIH, APAC, BPA, CNES e Gestão SUS Unificado (GSU)",
  "Tesouraria — Administração de Cartões e Controle Bancário",
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Hospital Jardim Amalia Ltda (Hospital Hinja) — Documento de referência: OFU-3371-807 / Philips Documento ID 40001000055", size: 16, italics: true, color: "666666" }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Cabeçalho / timbre
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: "HOSPITAL JARDIM AMALIA LTDA", bold: true, size: 26 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: "Hospital Hinja", bold: false, italics: true, size: 20, color: "444444" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 6 } },
          children: [new TextRun({ text: "[Endereço, CNPJ e dados de contato do hospital]", size: 16, italics: true, color: "999999" })],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400, before: 200 },
          children: [new TextRun({ text: "ATESTADO DE CAPACIDADE TÉCNICA", bold: true, size: 30 })],
        }),

        mixed([
          { text: "Atestamos, para os devidos fins e a quem possa interessar, que o Sr. " },
          { text: "Frederico Gomes", bold: true },
          { text: " (\"Fredim\"), portador do CPF nº [a completar], atuou como representante técnico do Hospital Jardim Amalia Ltda (Hospital Hinja) no acompanhamento, validação e oficialização de uso do sistema Tasy EMR, da Philips Clinical Informatics, tendo desempenhado suas atividades com competência, empenho e responsabilidade técnica." },
        ]),

        mixed([
          { text: "O projeto em questão refere-se à " },
          { text: "migração e implantação modular em plataforma HTML5", bold: true },
          { text: " do sistema Tasy EMR (Projeto nº 3371 | Sequência 807 | PRJ45847990 | PRJ8416246), com atividades de implantação finalizadas em " },
          { text: "31/05/2023", bold: true },
          { text: " e oficialização de uso firmada em " },
          { text: "23/08/2023", bold: true },
          { text: ", conforme Documento de Oficialização de Uso (OFU) nº OFU-3371-807, emitido pela Philips Clinical Informatics (Documento ID 40001000055, versão 1)." },
        ]),

        p("O sistema Tasy EMR, versão 3.07.1814, foi implantado contemplando, entre outras, as seguintes áreas e módulos funcionais:", { spacingAfter: 150 }),

        ...modulos.map(m => new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 60, line: 300 },
          indent: { left: 400 },
          bullet: { level: 0 },
          children: [new TextRun({ text: m, size: 20 })],
        })),

        mixed([
          { text: "Durante o período de acompanhamento do projeto, o Sr. Frederico Gomes demonstrou domínio técnico sobre os processos administrativos, assistenciais e financeiros contemplados pelo sistema, tendo contribuído ativamente para a validação das funcionalidades entregues e para a formalização do recebimento de instrução de uso, sem ressalvas." }
        ], { spacingBefore: 200 }),

        p("Por ser verdade, firmamos o presente atestado.", { spacingBefore: 100, spacingAfter: 600 }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: "[Cidade], [dia] de [mês] de [ano].", italics: true })],
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60, before: 400 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 1 } },
          children: [new TextRun({ text: "" })],
          indent: { left: 2000, right: 2000 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: "[Nome do responsável pela emissão]", bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 20 },
          children: [new TextRun({ text: "[Cargo — ex.: Diretor(a) Administrativo(a) / Coordenador(a) de TI]", size: 20 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Hospital Jardim Amalia Ltda (Hospital Hinja)", size: 20 })],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  require("fs").writeFileSync("Atestado_Capacidade_Tecnica_Frederico_Gomes.docx", buffer);
  console.log("OK");
});
