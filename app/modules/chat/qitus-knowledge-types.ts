export type QitusKnowledgeSource = {
  sourceId: string;
  title: string;
  content: string;
  href?: string;
  surface: string;
  audience: "user";
  anchor?: string;
};

export type QitusUserGuideSection = QitusKnowledgeSource & {
  wordCount: number;
};
