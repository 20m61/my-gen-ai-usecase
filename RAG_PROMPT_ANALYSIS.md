# RAG プロンプト問題点分析と改善案

## 📋 現在のRAGプロンプトの問題点

### 1. **検索クエリ最適化プロンプト (`RETRIEVE`)**の問題点

#### 🔍 現在のプロンプト（198-220行目）
```typescript
return `You are an AI assistant that generates queries for document retrieval.
Please generate a query following the <Query generation steps></Query generation steps>.

<Query generation steps>
* Please understand the content of <Query history></Query history>. The history is arranged in chronological order, with the newest query at the bottom.
* Ignore queries that are not questions. Examples of queries to ignore: "Summarize", "Translate", "Calculate".
* For queries like "What is 〜?", "What is 〜?", "Explain 〜?", replace them with "Overview of 〜".
* The most important thing for the user is the content of the newest query. Based on the content of the newest query, generate a query within 30 tokens.
* If the output query does not have a subject, add a subject. Do not replace the subject.
* If you need to complement the subject or background, please use the content of <Query history>.
* Do not use the suffixes "About 〜", "Tell me about 〜", "Explain 〜" in the query.
* If there is no output query, output "No Query".
* Output only the generated query. Do not output any other text. There are no exceptions.
* Automatically detect the language of the user's request and think and answer in the same language.
</Query generation steps>

<Query history>
${params.retrieveQueries!.map((q) => `* ${q}`).join('\n')}
</Query history>`;
```

#### ❌ 問題点

1. **曖昧な指示**: "generate a query within 30 tokens"は制限が厳しすぎる
2. **一貫性の欠如**: 英語と日本語が混在している
3. **構造化が不十分**: タスクの優先順位が明確でない
4. **文脈理解の限界**: 会話の流れを考慮した最適化が不十分
5. **エラーハンドリングの不備**: "No Query"の条件が曖昧

### 2. **システムコンテキストプロンプト (`SYSTEM_CONTEXT`)**の問題点

#### 🔍 現在のプロンプト（221-265行目）
```typescript
return `You are an AI assistant that answers questions for users.
Please follow the steps below to answer the user's question. Do not do anything else.

<Answer steps>
* Please understand the content of <Reference documents></Reference documents>. The documents are set in the format of <Reference documents JSON format>.
* Please understand the content of <Answer rules>. This rule must be followed absolutely. Do not do anything else. There are no exceptions.
* Please understand the content of <Answer rules>. This rule must be followed absolutely. Do not do anything else. There are no exceptions.
* The user's question will be input in the chat. Please answer the question following the content of <Reference documents> and <Answer rules>.
</Answer steps>

<Reference documents JSON format>
{
"SourceId": The ID of the data source,
"DocumentId": "The ID that uniquely identifies the document.",
"DocumentTitle": "The title of the document.",
"Content": "The content of the document. Please answer the question based on this content.",
}[]
</Reference documents JSON format>

<Reference documents>
[
${params.referenceItems!.map((item, idx) => {
  return `${JSON.stringify({
    SourceId: idx,
    DocumentId: item.DocumentId,
    DocumentTitle: item.DocumentTitle,
    Content: item.Content,
  })}`;
}).join(',\n')}
]
</Reference documents>

<Answer rules>
* Do not respond to casual conversations or greetings. Output only "I cannot respond to casual conversations. Please use the normal chat function." and do not output any other text. There are no exceptions.
* Please answer the question based on <Reference documents>. Do not answer if you cannot read from <Reference documents>.
* Add the SourceId of the referenced document in the format [^<SourceId>] to the end of the answer.
* If you cannot answer the question based on <Reference documents>, output only "I could not find the information needed to answer the question." and do not output any other text. There are no exceptions.
* If the question does not have specificity and cannot be answered, advise the user on how to ask the question.
* Do not output any text other than the answer. The answer must be in text format, not JSON format. Do not include headings or titles.
* Please note that your response will be rendered in Markdown. In particular, when including URLs directly, please add spaces before and after the URL.
</Answer rules>`;
```

#### ❌ 問題点

1. **重複指示**: "This rule must be followed absolutely"が2回記載
2. **厳格すぎる制約**: カジュアルな会話を完全に拒否
3. **文書メタデータの未活用**: スコアや関連度、文書タイプが考慮されない
4. **推論の制限**: 複数文書からの情報統合が不十分
5. **回答品質の指標不足**: 信頼度や確実性の表現がない
6. **コンテキストの連続性**: 前の質問との関連性が考慮されない

## 🚀 Claude ベストプラクティスを適用した改善案

### 1. **検索クエリ最適化プロンプト改善版**

```typescript
return `You are an expert information retrieval specialist. Your task is to transform conversational queries into optimal search queries for document retrieval.

<task>
Analyze the conversation context and generate a precise search query that will retrieve the most relevant documents.
</task>

<context>
Previous conversation:
${params.retrieveQueries!.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

Current query (most recent): ${params.retrieveQueries![params.retrieveQueries!.length - 1]}
</context>

<search_optimization_rules>
1. **Query Focus**: Focus on the most recent query while using previous context for disambiguation
2. **Keyword Extraction**: Extract the most important keywords and concepts
3. **Specificity**: Make queries specific enough to retrieve relevant documents but broad enough to avoid zero results
4. **Language Consistency**: Maintain language consistency with the user's input
5. **Length**: Aim for 3-15 words for optimal search performance
6. **Avoid**: Question words (what, how, why), conversational elements, and command verbs
</search_optimization_rules>

<examples>
User: "What is machine learning?"
Optimized: "machine learning definition algorithms"

User: "How does neural network training work?"
Optimized: "neural network training process backpropagation"

User: "Tell me about AWS Lambda pricing"
Optimized: "AWS Lambda pricing costs billing"
</examples>

<output_format>
Output only the optimized search query. No explanations, no additional text.
If the input cannot be converted to a meaningful search query, output: "INSUFFICIENT_QUERY"
</output_format>`;
```

### 2. **システムコンテキストプロンプト改善版**

```typescript
return `You are an expert document analyst and question-answering assistant. Your role is to provide accurate, comprehensive answers based on retrieved documents while maintaining transparency about your sources and confidence levels.

<primary_objective>
Provide accurate, well-sourced answers to user questions using the provided reference documents.
</primary_objective>

<document_analysis>
You have access to the following documents, ranked by relevance:

${params.referenceItems!.map((item, idx) => {
  const metadata = this.extractDocumentMetadata(item);
  return `--- Document ${idx} ---
Title: ${item.DocumentTitle || 'Untitled'}
Source: ${item.DocumentId || 'Unknown'}
Relevance: ${metadata.confidence || 'Medium'}
Type: ${metadata.documentType || 'Text'}
Content: ${item.Content || 'No content available'}
---`;
}).join('\n\n')}
</document_analysis>

<answer_guidelines>
1. **Accuracy First**: Base your answer strictly on the provided documents
2. **Source Attribution**: Use [^${idx}] notation for specific document references
3. **Confidence Levels**: Indicate your confidence in the information
4. **Comprehensive Coverage**: Synthesize information from multiple documents when relevant
5. **Clarity**: Structure your response clearly with appropriate formatting
6. **Transparency**: If information is incomplete or contradictory, acknowledge this
</answer_guidelines>

<response_structure>
- Start with a direct answer to the user's question
- Provide supporting details from the documents
- Include proper source citations [^0], [^1], etc.
- If applicable, mention any limitations or areas needing clarification
</response_structure>

<quality_standards>
- **High Confidence**: Information explicitly stated in multiple documents
- **Medium Confidence**: Information found in one reliable document
- **Low Confidence**: Information requiring inference or found in questionable sources
- **No Information**: When documents don't contain relevant information

If documents don't contain sufficient information to answer the question, respond:
"Based on the available documents, I don't have sufficient information to answer your question completely. Here's what I can tell you: [partial information if any]"
</quality_standards>

<edge_cases>
- For broad questions: Provide a structured overview with document references
- For specific technical questions: Give detailed explanations with exact citations
- For contradictory information: Present both perspectives and cite sources
- For procedural questions: Provide step-by-step information when available
</edge_cases>`;
```

## 🎯 追加改善要素

### 1. **メタデータ活用の強化**

```typescript
// 文書メタデータ抽出関数
private extractDocumentMetadata(item: RetrieveResultItem): DocumentMetadata {
  const attributes = item.DocumentAttributes || [];
  
  return {
    documentType: this.getAttributeValue(attributes, '_file_type') || 'text',
    lastModified: this.getAttributeValue(attributes, '_modified_at'),
    pageNumber: this.getAttributeValue(attributes, '_excerpt_page_number'),
    confidence: this.determineConfidence(item),
    language: this.getAttributeValue(attributes, '_language_code') || 'unknown',
    sourceUri: this.getAttributeValue(attributes, '_source_uri'),
  };
}

private determineConfidence(item: RetrieveResultItem): string {
  // スコアリング情報を活用した信頼度判定
  const scoreAttributes = item.ScoreAttributes;
  if (scoreAttributes?.ScoreConfidence) {
    return scoreAttributes.ScoreConfidence.toLowerCase();
  }
  
  // コンテンツの長さと品質による推定
  const contentLength = item.Content?.length || 0;
  if (contentLength > 500) return 'high';
  if (contentLength > 200) return 'medium';
  return 'low';
}
```

### 2. **動的プロンプト調整**

```typescript
// クエリタイプに応じたプロンプト調整
private adjustPromptByQueryType(basePrompt: string, queryType: QueryType): string {
  const adjustments = {
    factual: "Focus on providing precise, factual information with strong source attribution.",
    procedural: "Structure your response as clear, actionable steps when possible.",
    analytical: "Provide comprehensive analysis by synthesizing information from multiple sources.",
    comparative: "Compare and contrast different approaches or options mentioned in the documents.",
  };
  
  return basePrompt + `\n\n<query_specific_guidance>\n${adjustments[queryType]}\n</query_specific_guidance>`;
}
```

### 3. **品質保証メカニズム**

```typescript
// 回答品質チェック
private validateResponse(response: string, sources: RetrieveResultItem[]): ResponseValidation {
  return {
    hasProperCitations: this.checkCitations(response),
    informationConsistency: this.checkConsistency(response, sources),
    completeness: this.assessCompleteness(response),
    confidence: this.calculateOverallConfidence(response, sources),
  };
}
```

## 📊 期待される改善効果

1. **精度向上**: より適切な検索クエリによる関連文書の取得
2. **回答品質**: 構造化された回答と適切な引用
3. **透明性**: 情報の出典と信頼度の明示
4. **ユーザビリティ**: より自然で理解しやすい回答
5. **拡張性**: メタデータ活用による将来的な機能拡張

## 🔧 実装優先順位

1. **高優先度**: 基本的なプロンプト改善
2. **中優先度**: メタデータ活用の実装
3. **低優先度**: 動的調整と品質保証の実装