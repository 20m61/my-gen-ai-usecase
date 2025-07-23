# Amazon Kendra RAG Chat システム構成とプロンプト解説

## 更新履歴

- **v4.3.2** (2025年7月): 現在のバージョン
  - 高度な文書スコアリングシステムの実装
  - プロンプト戦略の大幅改善（Claude最適化）
  - 文書マージロジックの高度化
- **v0.0.6** (初期バージョン): 基本的なKendra検索機能のみ

## 1. システム概要

Amazon Kendraを使用したRAG（Retrieval-Augmented Generation）チャットシステムは、ユーザーの質問に対して関連文書を検索し、それらを基に精度の高い回答を生成する仕組みです。

## 📂 主要ファイル一覧

### フロントエンド（React）
- **`/packages/web/src/pages/RagPage.tsx`** - RAGチャットのメインUI
- **`/packages/web/src/hooks/useRag.ts`** - RAGフローの核となるロジック
- **`/packages/web/src/hooks/useRagApi.ts`** - バックエンドAPIとの通信
- **`/packages/web/src/prompts/claude.ts`** - プロンプトテンプレート定義

### Lambda関数
- **`/packages/cdk/lambda/retrieveKendra.ts`** - Kendraからの文書検索
- **`/packages/cdk/lambda/queryKendra.ts`** - Kendraクエリ実行
- **`/packages/cdk/lambda/predict.ts`** - 単発予測処理
- **`/packages/cdk/lambda/predictStream.ts`** - ストリーミング予測処理

### インフラストラクチャ
- **`/packages/cdk/lib/construct/rag.ts`** - Kendraリソースの定義
- **`/packages/cdk/lib/construct/api.ts`** - API Gateway設定
- **`/packages/cdk/lib/generative-ai-use-cases-stack.ts`** - メインスタック定義

### 設定・型定義
- **`/packages/types/src/chat.d.ts`** - チャット関連の型定義
- **`/packages/cdk/parameter.ts`** - パラメータ設定

## 2. アーキテクチャ図

```mermaid
graph TB
    User[👤 ユーザー]
    WebUI[🌐 Web UI<br/>React Frontend]
    APIGateway[🚪 API Gateway]
    
    subgraph "Lambda Functions"
        QueryOptimizer[🔍 クエリ最適化<br/>Lambda Function]
        KendraRetriever[📄 Kendra検索<br/>Lambda Function]
        ResponseGenerator[🤖 回答生成<br/>Lambda Function]
    end
    
    subgraph "AWS Services"
        Kendra[📚 Amazon Kendra<br/>文書検索インデックス]
        S3[🗂️ Amazon S3<br/>文書ストレージ]
        Bedrock[🧠 Amazon Bedrock<br/>生成AI モデル]
    end
    
    User --> WebUI
    WebUI --> APIGateway
    APIGateway --> QueryOptimizer
    QueryOptimizer --> Bedrock
    QueryOptimizer --> KendraRetriever
    KendraRetriever --> Kendra
    Kendra --> S3
    KendraRetriever --> ResponseGenerator
    ResponseGenerator --> Bedrock
    ResponseGenerator --> WebUI
    
    style User fill:#e1f5fe
    style WebUI fill:#f3e5f5
    style Kendra fill:#fff3e0
    style Bedrock fill:#e8f5e8
    style S3 fill:#fce4ec
```

## 3. 処理フロー詳細

### 3.1 全体のデータフロー

```mermaid
sequenceDiagram
    participant User as 👤 ユーザー
    participant WebUI as 🌐 Web UI
    participant API as 🚪 API Gateway
    participant QueryOpt as 🔍 クエリ最適化
    participant Bedrock1 as 🧠 Bedrock(最適化)
    participant Retriever as 📄 Kendra検索
    participant Kendra as 📚 Kendra
    participant Generator as 🤖 回答生成
    participant Bedrock2 as 🧠 Bedrock(生成)
    
    User->>WebUI: 質問入力
    WebUI->>API: POST /rag/query
    API->>QueryOpt: クエリ最適化要求
    QueryOpt->>Bedrock1: 検索用クエリ生成
    Bedrock1-->>QueryOpt: 最適化されたクエリ
    QueryOpt->>Retriever: 最適化クエリ送信
    Retriever->>Kendra: 文書検索実行
    Kendra-->>Retriever: 関連文書リスト
    Retriever->>Generator: 文書 + 元の質問
    Generator->>Bedrock2: システムコンテキスト設定
    Bedrock2-->>Generator: RAG回答生成
    Generator-->>WebUI: 回答 + 出典情報
    WebUI-->>User: 回答表示
```

## 4. 主要コンポーネント詳細

### 4.1 フロントエンド（React）

#### 📄 `/packages/web/src/hooks/useRag.ts` - RAGフローの中核ロジック

```typescript
// RAGフローの中核ロジック（46-51行目）
const onSend = useCallback(() => {
  setFollowing(true);
  postMessage(content);  // RAGフロー開始
  setContent('');
}, [content, postMessage, setContent, setFollowing]);
```

#### 📄 `/packages/web/src/pages/RagPage.tsx` - RAGチャットUI

```typescript
// RAGページのメインコンポーネント（使用例）
const RagPage: React.FC = () => {
  const { onSend, content, setContent } = useRag();
  
  return (
    <div className="flex flex-col h-full">
      {/* チャット表示エリア */}
      <div className="flex-1 overflow-y-auto">
        {/* チャットメッセージ */}
      </div>
      
      {/* 入力エリア */}
      <InputChatContent
        content={content}
        onChangeContent={setContent}
        onSend={onSend}
      />
    </div>
  );
};
```

### 4.2 クエリ最適化段階

#### 📄 `/packages/web/src/hooks/useRag.ts` - クエリ最適化処理

**目的**: ユーザーの質問を文書検索に適した形式に変換

```typescript
// Step 1: 検索用クエリの最適化（106-120行目付近）
const query = await predict({
  model: model,
  messages: [
    {
      role: 'user',
      content: prompter.ragPrompt({
        promptType: 'RETRIEVE',
        retrieveQueries: [...prevQueries, content],
      }),
    },
  ],
  id: id,
});
```

#### 📄 `/packages/web/src/hooks/useRagApi.ts` - API通信

```typescript
// Bedrock predict API呼び出し
export const predict = async (params: PredictParams): Promise<string> => {
  const response = await fetch(`/api/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  
  return response.text();
};
```

### 4.3 検索クエリ生成プロンプト（改善版）

#### 📄 `/packages/web/src/prompts/claude.ts` - プロンプトテンプレート定義

```typescript
// RETRIEVE用プロンプトテンプレート（199-221行目）
ragPrompt(params: RagParams): string {
  if (params.promptType === 'RETRIEVE') {
    return `You are a search query optimization expert. Transform the user's conversational query into an effective search query for document retrieval.

# Task
Focus on the most recent query while considering conversation history for context. Extract key concepts and keywords that will find the most relevant documents.

# Guidelines
- Output 3-15 words capturing the main topic
- Focus on nouns, technical terms, and specific concepts
- Remove question words (what, how, why, etc.) and conversational elements
- Use the exact language of the input query
- If the query is unclear or too vague, return "INSUFFICIENT_QUERY"

# Examples
Input: "What is machine learning?"
Output: machine learning overview concepts

Input: "How do I implement authentication in React?"
Output: React authentication implementation methods

# Conversation History
${params.retrieveQueries!.map((q) => `- ${q}`).join('\n')}`;
  }
}
```

**改善点**:
- **Claude最適化**: タスク指向の明確な指示
- **柔軟な長さ**: 30トークン制限から3-15単語へ
- **具体例の追加**: 変換パターンの明示
- **エラーハンドリング**: `INSUFFICIENT_QUERY`フォールバック

#### 📄 `/packages/types/src/chat.d.ts` - 型定義

```typescript
// RAGパラメータの型定義
export type RagParams = {
  promptType: 'RETRIEVE' | 'SYSTEM_CONTEXT';
  retrieveQueries?: string[];
  referenceItems?: RetrieveResultItem[];
};
```

### 4.4 Kendra文書検索

#### 📄 `/packages/cdk/lambda/retrieveKendra.ts` - Kendra検索実行

```typescript
// Kendraから関連文書を取得（40-55行目付近）
const retrieveCommand = new RetrieveCommand({
  IndexId: INDEX_ID,
  QueryText: query,
  AttributeFilter: {
    AndAllFilters: [
      {
        EqualsTo: {
          Key: '_language_code',
          Value: { StringValue: LANGUAGE },
        },
      },
    ],
  },
});
const retrieveRes = await kendra.send(retrieveCommand);
```

#### 📄 `/packages/cdk/lambda/utils/auth.ts` - 認証処理

```typescript
// Lambda関数での認証ヘルパー
export const getAuthenticatedUser = (event: APIGatewayProxyEvent) => {
  const userId = event.requestContext.authorizer?.claims?.sub;
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
};
```

#### 📄 `/packages/web/src/hooks/useRagApi.ts` - 検索API呼び出し

```typescript
// Kendra検索API呼び出し
export const retrieve = async (query: string): Promise<RetrieveResponse> => {
  const response = await fetch('/api/rag/retrieve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  
  return response.json();
};
```

### 4.5 文書の重複除去処理（高度化版）

#### 📄 `/packages/web/src/hooks/useRag.ts` - 文書統合処理

```typescript
// 文書スコアリングと統合処理
import { ragSettings } from '../config/ragSettings';

// 関連性スコアの計算
const calculateRelevanceScore = (item: RetrieveResultItem): number => {
  let score = 0;
  
  // 基本スコア（Kendraの信頼度）
  const confidence = item.ScoreAttributes?.ScoreConfidence;
  score += ragSettings.scoring.confidenceWeights[confidence || 'MEDIUM'];
  
  // コンテンツ長によるボーナス
  const contentLength = item.Content?.length || 0;
  if (contentLength > 1000) score += ragSettings.scoring.lengthBonus.long;
  else if (contentLength > 500) score += ragSettings.scoring.lengthBonus.medium;
  else if (contentLength < 100) score += ragSettings.scoring.lengthBonus.short;
  
  // 文書タイプによるボーナス
  const fileType = item.DocumentAttributes?.find(a => a.Key === '_file_type')?.Value?.StringValue;
  score += ragSettings.scoring.documentTypeBonus[fileType || 'txt'] || 0;
  
  // タイトルの質によるボーナス
  if (item.DocumentTitle && item.DocumentTitle.length > 10) {
    score += ragSettings.scoring.titleQualityBonus;
  }
  
  return score;
};

// 文書の統合とフィルタリング
export const arrangeItems = (items: RetrieveResultItem[]): RetrieveResultItem[] => {
  // 品質フィルタリング
  const qualityItems = items.filter(item => 
    (item.Content?.length || 0) >= ragSettings.qualityThresholds.minContentLength
  );
  
  // スコア計算と並び替え
  const scoredItems = qualityItems.map(item => ({
    ...item,
    relevanceScore: calculateRelevanceScore(item)
  })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // 同一文書のマージ
  const mergedItems: Record<string, RetrieveResultItem> = {};
  
  for (const item of scoredItems) {
    const uri = item.DocumentURI || '';
    
    if (mergedItems[uri]) {
      // ページ番号を保持しながらマージ
      const pageNum = item.DocumentAttributes?.find(
        a => a.Key === '_excerpt_page_number'
      )?.Value?.LongValue;
      
      const pagePrefix = pageNum ? `[Page ${pageNum}] ` : '';
      mergedItems[uri].Content += `\n\n${pagePrefix}${item.Content}`;
      
      // 最高スコアを保持
      if (item.relevanceScore > mergedItems[uri].relevanceScore) {
        mergedItems[uri].relevanceScore = item.relevanceScore;
      }
    } else {
      mergedItems[uri] = item;
    }
  }
  
  // 最終的な文書数の制限
  return Object.values(mergedItems)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, ragSettings.maxDocuments);
};
```

**改善点**:
- **マルチファクタースコアリング**: 信頼度、長さ、文書タイプ、タイトル品質
- **品質フィルタリング**: 短すぎる文書の除外
- **インテリジェントマージ**: ページ番号を保持した文書統合
- **設定の外部化**: `ragSettings`による柔軟な調整

#### 📄 `/packages/types/src/chat.d.ts` - 検索結果の型定義

```typescript
// Kendra検索結果の型定義
export interface RetrieveResultItem {
  Id?: string;
  DocumentId?: string;
  DocumentTitle?: string;
  DocumentURI?: string;
  Content?: string;
  DocumentAttributes?: DocumentAttribute[];
  ScoreAttributes?: ScoreAttributes;
}

export interface DocumentAttribute {
  Key: string;
  Value: {
    StringValue?: string;
    LongValue?: number;
    DateValue?: Date;
  };
}
```

### 4.6 システムコンテキスト設定

#### 📄 `/packages/web/src/hooks/useRag.ts` - システムコンテキスト更新

```typescript
// 検索された文書でシステムコンテキスト更新（130-137行目付近）
updateSystemContext(
  prompter.ragPrompt({
    promptType: 'SYSTEM_CONTEXT',
    referenceItems: items,
  })
);
```

#### 📄 `/packages/web/src/hooks/useChat.ts` - チャット状態管理

```typescript
// システムコンテキストの更新処理
const updateSystemContext = useCallback((context: string) => {
  setSystemContext(context);
}, []);

// チャット送信処理
const postMessage = useCallback(
  (
    content: string,
    systemContext?: string,
    preprocessing?: (messages: ShownMessage[]) => ShownMessage[],
    postprocessing?: (message: string) => string
  ) => {
    // システムコンテキストを含むメッセージの送信処理
  },
  [messages, model]
);
```

### 4.7 システムコンテキスト用プロンプト（改善版）

#### 📄 `/packages/web/src/prompts/claude.ts` - RAGシステムの核となるプロンプト

```typescript
// SYSTEM_CONTEXT用プロンプトテンプレート（223-251行目）
ragPrompt(params: RagParams): string {
  if (params.promptType === 'SYSTEM_CONTEXT') {
    return `You are a document analyst providing accurate answers based solely on provided reference documents.

# Task
Answer the user's question using ONLY information from the reference documents below. Include citations for all facts.

# Reference Documents
${params.referenceItems!.map((item, idx) => {
  const metadata = [];
  if (item.DocumentAttributes) {
    const pageNum = item.DocumentAttributes.find(a => a.Key === '_excerpt_page_number')?.Value?.LongValue;
    const fileType = item.DocumentAttributes.find(a => a.Key === '_file_type')?.Value?.StringValue;
    if (pageNum) metadata.push(`Page ${pageNum}`);
    if (fileType) metadata.push(fileType.toUpperCase());
  }
  const confidence = item.ScoreAttributes?.ScoreConfidence || 'MEDIUM';
  metadata.push(`Confidence: ${confidence}`);
  
  return `[Document ${idx}]
Title: ${item.DocumentTitle}
Metadata: ${metadata.join(', ')}
Content: ${item.Content}`;
}).join('\n\n')}

# Response Guidelines
- Use information ONLY from the reference documents
- Add citations [^0], [^1], etc. for each fact or quote
- If confidence is LOW, mention this when using that source
- Structure your response clearly with paragraphs or bullet points as appropriate
- If you cannot answer from the documents, say: "I could not find sufficient information in the provided documents to answer this question."
- Your response will be rendered in Markdown`;
  }
}
```

**改善点**:
- **メタデータ活用**: ページ番号、ファイルタイプ、信頼度レベル
- **構造化された文書表示**: より読みやすい形式
- **信頼度の明示**: LOW信頼度の場合の注意喚起
- **柔軟な回答形式**: 段落や箇条書きの使用を推奨

#### 📄 `/packages/web/src/prompts/index.ts` - プロンプト管理

```typescript
// プロンプタークラスのインスタンス作成
import { ClaudePrompter } from './claude';

export const prompter = new ClaudePrompter();
```

### 4.8 回答生成と脚注処理

#### 📄 `/packages/web/src/hooks/useRag.ts` - 前処理（過去メッセージから脚注削除）

```typescript
// 前処理: Few-shot用に過去ログから脚注を削除（140-150行目付近）
const preprocessing = (messages: ShownMessage[]) => {
  return messages.map((message) => ({
    ...message,
    content: message.content
      .replace(/\[\^0\]:[\s\S]*/s, '') // 末尾の脚注を削除
      .replace(/\[\^(\d+)\]/g, '') // 脚注アンカーを削除
      .trim(),
  }));
};
```

#### 📄 `/packages/web/src/hooks/useRag.ts` - 後処理（脚注情報追加）

```typescript
// 後処理: 脚注とドキュメントリンクを追加（150-170行目付近）
const postprocessing = (message: string) => {
  const footnote = items
    .map((item, idx) => {
      const _excerpt_page_number = item.DocumentAttributes?.find(
        (attr) => attr.Key === '_excerpt_page_number'
      )?.Value?.LongValue;
      return message.includes(`[^${idx}]`)
        ? `[^${idx}]: [${item.DocumentTitle}${
            _excerpt_page_number ? `(${_excerpt_page_number} ページ)` : ''
          }](${item.DocumentURI ? cleanEncode(item.DocumentURI) : ''}${
            _excerpt_page_number ? `#page=${_excerpt_page_number}` : ''
          })`
        : '';
    })
    .filter((x) => x)
    .join('\n');
  return message + '\n' + footnote;
};
```

#### 📄 `/packages/web/src/utils/utils.ts` - URL エンコーディング

```typescript
// URL の安全なエンコーディング処理
export const cleanEncode = (uri: string): string => {
  return encodeURI(uri.replace(/[<>"{}|\\^`\[\]]/g, ''));
};
```

#### 📄 `/packages/cdk/lambda/predict.ts` - 予測処理実行

```typescript
// Bedrock予測処理（20-40行目付近）
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId = getAuthenticatedUser(event);
  const { messages, model } = JSON.parse(event.body || '{}');
  
  // Bedrock API呼び出し
  const response = await predict({
    messages: messages,
    model: model,
    userId: userId,
  });
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
};
```

## 5. インフラストラクチャ設定

### 5.1 Kendraインデックス設定

#### 📄 `/packages/cdk/lib/construct/rag.ts` - Kendraリソース定義

```typescript
// Kendraインデックスの設定（190-205行目付近）
const indexProps: kendra.CfnIndexProps = {
  name: `generative-ai-use-cases-index${envSuffix}`,
  edition: 'DEVELOPER_EDITION',
  roleArn: indexRole.roleArn,
  userContextPolicy: 'USER_TOKEN', // トークンベースのアクセス制御
  userTokenConfigurations: [{
    jwtTokenTypeConfiguration: {
      keyLocation: 'URL',
      userNameAttributeField: 'cognito:username',
      groupAttributeField: 'cognito:groups',
      url: `${props.userPool.userPoolProviderUrl}/.well-known/jwks.json`,
    },
  }],
};
```

#### 📄 `/packages/cdk/parameter.ts` - パラメータ設定

```typescript
// Kendraの設定パラメータ
export const kendraIndexLanguage = 'ja'; // 日本語設定
export const kendraIndexEdition = 'DEVELOPER_EDITION'; // 開発版
```

### 5.2 S3データソース設定

#### 📄 `/packages/cdk/lib/construct/rag.ts` - S3データソース定義

```typescript
// S3データソースの設定（280-295行目付近）
const dataSourceProps: kendra.CfnDataSourceProps = {
  indexId: index.attrId,
  type: 'S3',
  name: 's3-data-source',
  roleArn: s3DataSourceRole.roleArn,
  languageCode: kendraIndexLanguage,
  dataSourceConfiguration: {
    s3Configuration: {
      bucketName: dataSourceBucket.bucketName,
      inclusionPrefixes: ['docs'], // docsフォルダのみ対象
    },
  },
};
```

#### 📄 `/packages/cdk/lib/construct/rag.ts` - S3バケット設定

```typescript
// RAG用S3バケットの作成（100-120行目付近）
const dataSourceBucket = new s3.Bucket(this, 'RagDataSourceBucket', {
  bucketName: `generative-ai-use-cases-rag-data-source-${props.stackName}`,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  versioned: true,
  lifecycleRules: [{
    id: 'delete-old-versions',
    enabled: true,
    noncurrentVersionExpiration: Duration.days(7),
  }],
});
```

### 5.3 API Gateway設定

#### 📄 `/packages/cdk/lib/construct/api.ts` - APIエンドポイント定義

```typescript
// RAG用APIエンドポイント（200-220行目付近）
const ragResource = api.root.addResource('rag');

// POST: /rag/retrieve
const retrieveResource = ragResource.addResource('retrieve');
retrieveResource.addMethod('POST', new LambdaIntegration(retrieveFunction), {
  authorizer: authorizer,
  authorizationType: AuthorizationType.COGNITO,
});

// POST: /rag/query
const queryResource = ragResource.addResource('query');
queryResource.addMethod('POST', new LambdaIntegration(queryFunction), {
  authorizer: authorizer,
  authorizationType: AuthorizationType.COGNITO,
});
```

### 5.4 Lambda関数設定

#### 📄 `/packages/cdk/lib/construct/rag.ts` - Lambda関数定義

```typescript
// Kendra検索Lambda関数（350-370行目付近）
const retrieveFunction = new lambda.Function(this, 'RetrieveFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'retrieveKendra.handler',
  code: lambda.Code.fromAsset('lambda'),
  timeout: Duration.minutes(15),
  memorySize: 512,
  environment: {
    KENDRA_INDEX_ID: index.attrId,
    LANGUAGE: kendraIndexLanguage,
  },
});
```

## 6. セキュリティ機能

### 6.1 認証・認可

#### 📄 `/packages/cdk/lib/construct/auth.ts` - Cognito設定

```typescript
// Cognito User Pool設定（50-70行目付近）
const userPool = new cognito.UserPool(this, 'UserPool', {
  userPoolName: `generative-ai-use-cases-user-pool-${props.stackName}`,
  selfSignUpEnabled: true,
  signInAliases: {
    email: true,
    username: true,
  },
  autoVerify: {
    email: true,
  },
  passwordPolicy: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireDigits: true,
    requireSymbols: true,
  },
});
```

#### 📄 `/packages/cdk/lambda/utils/auth.ts` - Lambda認証処理

```typescript
// Lambda関数での認証処理（10-25行目付近）
export const getAuthenticatedUser = (event: APIGatewayProxyEvent): string => {
  const userId = event.requestContext.authorizer?.claims?.sub;
  const email = event.requestContext.authorizer?.claims?.email;
  
  if (!userId) {
    throw new Error('Unauthorized: No user ID found in token');
  }
  
  return userId;
};

export const getUserGroups = (event: APIGatewayProxyEvent): string[] => {
  const groups = event.requestContext.authorizer?.claims?.['cognito:groups'];
  return groups ? groups.split(',') : [];
};
```

### 6.2 言語フィルタリング

#### 📄 `/packages/cdk/lambda/retrieveKendra.ts` - 言語フィルタリング

```typescript
// 言語による検索結果フィルタリング（35-50行目付近）
const attributeFilter: AttributeFilter = {
  AndAllFilters: [
    {
      EqualsTo: {
        Key: '_language_code',
        Value: { StringValue: LANGUAGE },
      },
    },
  ],
};
```

### 6.3 IAMロール設定

#### 📄 `/packages/cdk/lib/construct/rag.ts` - IAMロール定義

```typescript
// Kendra用IAMロール（150-180行目付近）
const kendraRole = new iam.Role(this, 'KendraRole', {
  assumedBy: new iam.ServicePrincipal('kendra.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'),
  ],
  inlinePolicies: {
    KendraPolicy: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:ListBucket',
          ],
          resources: [
            dataSourceBucket.bucketArn,
            `${dataSourceBucket.bucketArn}/*`,
          ],
        }),
      ],
    }),
  },
});
```

## 7. 最適化機能

### 7.1 2段階処理

#### 📄 `/packages/web/src/hooks/useRag.ts` - 2段階処理の実装

```typescript
// 2段階処理の実装（100-170行目）
const processRAG = async (content: string) => {
  // 段階1: クエリ最適化
  const optimizedQuery = await predict({
    model: model,
    messages: [
      {
        role: 'user',
        content: prompter.ragPrompt({
          promptType: 'RETRIEVE',
          retrieveQueries: [...prevQueries, content],
        }),
      },
    ],
    id: id,
  });
  
  // 段階2: 文書検索
  const retrievedItems = await retrieve(optimizedQuery);
  const items = arrangeItems(retrievedItems.data.ResultItems ?? []);
  
  // 段階3: 回答生成
  updateSystemContext(
    prompter.ragPrompt({
      promptType: 'SYSTEM_CONTEXT',
      referenceItems: items,
    })
  );
};
```

### 7.2 文書の統合処理

#### 📄 `/packages/web/src/hooks/useRag.ts` - 重複排除ロジック

```typescript
// 同じ文書からの複数結果を統合（190-210行目）
export const arrangeItems = (items: RetrieveResultItem[]): RetrieveResultItem[] => {
  // 文書URI + ページ番号で一意キーを生成
  // 同じキーの場合は内容を「...」で連結
  // 冗長性を排除しながら情報を保持
};
```

### 7.3 自動脚注生成

#### 📄 `/packages/web/src/hooks/useRag.ts` - 脚注生成ロジック

```typescript
// 脚注の自動生成（150-170行目）
const postprocessing = (message: string) => {
  // [^0], [^1] などの参照番号を検出
  // 対応する文書タイトルとリンクを生成
  // ページ番号も含めてクリック可能なリンクを作成
};
```

## 8. コスト最適化

### 8.1 Kendraスケジューリング

#### 📄 `/packages/cdk/lib/construct/rag.ts` - スケジューリング設定

```typescript
// Kendraインデックスの自動開始・停止スケジューリング（1685-1763行目）
const scheduleRule = new events.Rule(this, 'KendraScheduleRule', {
  schedule: events.Schedule.cron({
    minute: '0',
    hour: '9',
    weekDay: '1-5', // 平日のみ
  }),
});

// Step Functions による自動開始・停止
const startKendraFunction = new sfn.Pass(this, 'StartKendra', {
  result: sfn.Result.fromObject({
    action: 'START',
    indexId: index.attrId,
  }),
});
```

#### 📄 `/packages/cdk/parameter.ts` - コスト関連設定

```typescript
// コスト最適化のための設定
export const kendraSchedulingEnabled = true; // スケジューリング有効化
export const kendraAutoShutdownHours = 18; // 自動停止時間（18時）
export const kendraAutoStartHours = 9; // 自動開始時間（9時）
```

### 8.2 開発者向け設定

#### 📄 `/packages/cdk/lib/construct/rag.ts` - 開発環境設定

```typescript
// 開発環境用のコスト最適化（180-200行目）
const isDevelopment = process.env.NODE_ENV === 'development';

const indexProps: kendra.CfnIndexProps = {
  edition: isDevelopment ? 'DEVELOPER_EDITION' : 'ENTERPRISE_EDITION',
  // 開発環境では低コストなDeveloper Editionを使用
};
```

## 9. 監視とログ

### 9.1 CloudWatch統合

#### 📄 `/packages/cdk/lib/construct/rag.ts` - CloudWatchログ設定

```typescript
// Lambda関数のログ設定（400-420行目）
const retrieveFunction = new lambda.Function(this, 'RetrieveFunction', {
  // ... 他の設定
  logRetention: logs.RetentionDays.ONE_WEEK,
  environment: {
    LOG_LEVEL: 'INFO',
  },
});

// CloudWatch メトリクス設定
const kendraMetrics = new cloudwatch.Metric({
  namespace: 'AWS/Kendra',
  metricName: 'QueryCount',
  dimensionsMap: {
    IndexId: index.attrId,
  },
});
```

#### 📄 `/packages/cdk/lambda/utils/logger.ts` - ログ出力

```typescript
// 構造化ログの出力
export const logger = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      data,
    }));
  },
  error: (message: string, error?: Error) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      error: error?.message,
      stack: error?.stack,
    }));
  },
};
```

### 9.2 コスト監視

#### 📄 `/packages/cdk/lib/construct/rag.ts` - コスト監視設定

```typescript
// コスト監視アラーム（500-520行目）
const costAlarm = new cloudwatch.Alarm(this, 'KendraCostAlarm', {
  metric: kendraMetrics,
  threshold: 1000, // クエリ数の閾値
  evaluationPeriods: 1,
  alarmDescription: 'Kendra query count exceeded threshold',
});

// SNS通知設定
const costTopic = new sns.Topic(this, 'CostAlertTopic');
costAlarm.addAlarmAction(new actions.SnsAction(costTopic));
```

---

## 9. プロンプト戦略の進化

### 9.1 バージョン間の比較

| 機能 | v0.0.6 | v4.3.2 (現在) |
|------|---------|---------------|
| クエリ最適化 | 30トークン制限のみ | 3-15単語の柔軟な最適化 |
| プロンプト言語 | 日本語/英語混在 | 言語統一、Claude最適化 |
| 文書スコアリング | なし | マルチファクター計算 |
| エラーハンドリング | 基本的 | INSUFFICIENT_QUERYフォールバック |
| メタデータ活用 | 最小限 | ページ番号、信頼度、ファイルタイプ |
| 文書マージ | 単純な連結 | インテリジェントマージ |

### 9.2 現在の最適化技術

1. **クエリ最適化パイプライン**
   - 会話履歴の文脈理解
   - キーワード抽出とノイズ除去
   - 言語一貫性の保持

2. **文書処理パイプライン**
   - 関連性スコアリング（4要素）
   - 品質フィルタリング
   - コンテキスト保持型マージ

3. **回答生成パイプライン**
   - メタデータ強化型プロンプト
   - 信頼度レベルの明示
   - 構造化された引用管理

## 📋 ファイル別機能マップ

### フロントエンド
- **`useRag.ts`**: RAGフローの制御、2段階処理、脚注生成、スコアリング
- **`useRagApi.ts`**: バックエンドAPI通信
- **`claude.ts`**: 全プロンプトテンプレート（改善版）
- **`RagPage.tsx`**: RAGチャットUI
- **`ragSettings.ts`**: スコアリング設定、品質閾値（新規）

### バックエンド
- **`retrieveKendra.ts`**: Kendra検索実行
- **`predict.ts`**: Bedrock予測処理
- **`auth.ts`**: 認証処理

### インフラ
- **`rag.ts`**: Kendra、Lambda、API Gateway設定
- **`auth.ts`**: Cognito設定
- **`parameter.ts`**: 設定パラメータ

### 型定義
- **`chat.d.ts`**: 全型定義

### テスト
- **`useRag.test.ts`**: 文書処理ロジックのテスト（新規）

この構成により、高精度で信頼性の高いRAGチャットシステムを実現しています。v0.0.6から大幅に進化し、エンタープライズグレードの文書検索と回答生成が可能になりました。