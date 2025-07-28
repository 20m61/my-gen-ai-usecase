# Parameter.ts 設定完全ガイド

このドキュメントでは、`packages/cdk/parameter.ts`で設定可能な全パラメータについて、カテゴリ別に詳細に解説します。

## 目次

- [基本概念](#基本概念)
- [環境設定の構造](#環境設定の構造)
- [基本設定](#基本設定)  
- [認証・アクセス制御](#認証アクセス制御)
- [モデル設定](#モデル設定)
- [RAG（Retrieval-Augmented Generation）設定](#ragretrieval-augmented-generation設定)
- [エージェント設定](#エージェント設定)
- [フロー・機能制御](#フロー機能制御)
- [ネットワーク・セキュリティ](#ネットワークセキュリティ)
- [カスタムドメイン・インフラ](#カスタムドメインインフラ)
- [環境別設定例](#環境別設定例)

## 基本概念

`parameter.ts`では、複数の環境（development、staging、production等）ごとに異なる設定を定義できます。これにより、環境に応じた適切なセキュリティレベルや機能制限を設定できます。

### 優先順位

1. `parameter.ts`で定義された環境設定
2. `cdk.json`のcontext設定（フォールバック）

## 環境設定の構造

```typescript
const envs: Record<string, Partial<StackInput>> = {
  dev: {
    // 開発環境の設定
  },
  staging: {
    // ステージング環境の設定  
  },
  prod: {
    // 本番環境の設定
  },
};
```

## 基本設定

### AWSアカウント・リージョン

```typescript
env: {
  account: "123456789012",                 // AWSアカウントID
  region: "ap-northeast-1",               // デプロイリージョン
  anonymousUsageTracking: false,          // 匿名使用状況追跡の無効化
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `account` | string | `process.env.CDK_DEFAULT_ACCOUNT` | AWSアカウントID |
| `region` | string | `us-east-1` | デプロイ先AWSリージョン |
| `anonymousUsageTracking` | boolean | `true` | 匿名使用状況追跡の有効/無効 |

## 認証・アクセス制御

### セルフサインアップ設定

```typescript
env: {
  selfSignUpEnabled: false,               // セルフサインアップの無効化
  allowedSignUpEmailDomains: [            // 許可するメールドメイン
    "company.com",
    "example.org"
  ],
}
```

### SAML認証設定

```typescript
env: {
  samlAuthEnabled: true,                  // SAML認証の有効化
  samlCognitoDomainName: "auth-domain",   // Cognitoドメイン名
  samlCognitoFederatedIdentityProviderName: "company-saml", // IDプロバイダー名
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `selfSignUpEnabled` | boolean | `true` | ユーザーの自己登録を許可 |
| `allowedSignUpEmailDomains` | string[] | null | 登録を許可するメールドメインリスト |
| `samlAuthEnabled` | boolean | `false` | SAML認証の有効化 |
| `samlCognitoDomainName` | string | null | Cognitoドメインのカスタムドメイン名 |
| `samlCognitoFederatedIdentityProviderName` | string | null | SAML IDプロバイダーの名前 |

## モデル設定

### AI モデル設定

```typescript
env: {
  modelRegion: "us-east-1",               // モデルが利用可能なリージョン
  modelIds: [                             // 利用可能なテキスト生成モデル
    "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "us.amazon.nova-premier-v1:0",
    {
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0", 
      region: "ap-northeast-1"            // モデル固有のリージョン指定
    }
  ],
  imageGenerationModelIds: [              // 画像生成モデル
    "amazon.nova-canvas-v1:0"
  ],
  videoGenerationModelIds: [              // 動画生成モデル  
    "amazon.nova-reel-v1:0"
  ],
  speechToSpeechModelIds: [               // 音声変換モデル
    "amazon.nova-sonic-v1:0"
  ],
  endpointNames: ["my-custom-endpoint"],  // カスタムエンドポイント名
  crossAccountBedrockRoleArn: "arn:aws:iam::...", // クロスアカウントロール
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `modelRegion` | string | `us-east-1` | Bedrockモデルのメインリージョン |
| `modelIds` | (string \| ModelConfig)[] | Claude等のリスト | テキスト生成モデルのID一覧 |
| `imageGenerationModelIds` | (string \| ModelConfig)[] | Nova Canvas | 画像生成モデルのID一覧 |
| `videoGenerationModelIds` | (string \| ModelConfig)[] | Nova Reel | 動画生成モデルのID一覧 |
| `speechToSpeechModelIds` | (string \| ModelConfig)[] | Nova Sonic | 音声変換モデルのID一覧 |
| `endpointNames` | string[] | `[]` | カスタムエンドポイント名の配列 |
| `crossAccountBedrockRoleArn` | string | null | 別アカウントのBedrockアクセス用ロールARN |

### ModelConfigurationオブジェクト

```typescript
{
  modelId: "model-name",
  region: "us-west-2"
}
```

## RAG（Retrieval-Augmented Generation）設定

### Amazon Kendra RAG

```typescript
env: {
  ragEnabled: true,                       // Kendra RAGの有効化
  kendraIndexLanguage: "ja",              // インデックス言語
  kendraIndexArn: "arn:aws:kendra:...",   // 既存インデックスのARN
  kendraDataSourceBucketName: "my-docs-bucket", // データソースS3バケット
  kendraIndexScheduleEnabled: true,       // スケジュール実行の有効化
  kendraIndexScheduleCreateCron: {        // インデックス作成スケジュール
    minute: "0",
    hour: "2", 
    month: "*",
    weekDay: "*"
  },
  kendraIndexScheduleDeleteCron: {        // インデックス削除スケジュール
    minute: "0",
    hour: "3",
    month: "*", 
    weekDay: "SUN"
  },
}
```

### Knowledge Base RAG

```typescript
env: {
  ragKnowledgeBaseEnabled: true,          // Knowledge Base RAGの有効化
  ragKnowledgeBaseId: "KB123456",         // 既存Knowledge BaseのID
  embeddingModelId: "amazon.titan-embed-text-v2:0", // 埋め込みモデル
  ragKnowledgeBaseStandbyReplicas: true,  // 高可用性設定（本番環境推奨）
  ragKnowledgeBaseAdvancedParsing: true,  // 高度解析機能
  ragKnowledgeBaseAdvancedParsingModelId: "anthropic.claude-3-sonnet-20240229-v1:0",
  ragKnowledgeBaseBinaryVector: false,    // バイナリベクトル埋め込み
  queryDecompositionEnabled: true,        // クエリ分解機能
  rerankingModelId: "cohere.rerank-v3-5:0", // 再順位付けモデル
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `ragEnabled` | boolean | `false` | Amazon Kendra RAGの有効化 |
| `kendraIndexLanguage` | string | `"ja"` | Kendraインデックスの言語設定 |
| `kendraIndexArn` | string | null | 既存Kendraインデックスを使用する場合のARN |
| `kendraDataSourceBucketName` | string | null | KendraデータソースS3バケット名 |
| `kendraIndexScheduleEnabled` | boolean | `false` | スケジュール実行の有効化 |
| `ragKnowledgeBaseEnabled` | boolean | `false` | Knowledge Base RAGの有効化 |
| `ragKnowledgeBaseId` | string | null | 既存Knowledge BaseのID |
| `embeddingModelId` | string | `"amazon.titan-embed-text-v2:0"` | 埋め込みモデル |
| `ragKnowledgeBaseStandbyReplicas` | boolean | `false` | 高可用性のためのスタンバイレプリカ |
| `ragKnowledgeBaseAdvancedParsing` | boolean | `false` | 表やグラフの高度解析機能 |
| `ragKnowledgeBaseBinaryVector` | boolean | `false` | バイナリベクトル埋め込みの使用 |
| `queryDecompositionEnabled` | boolean | `false` | 複雑なクエリの分解機能 |
| `rerankingModelId` | string | null | 検索結果の再順位付けモデル |

#### 利用可能な埋め込みモデル

- `amazon.titan-embed-text-v1`
- `amazon.titan-embed-text-v2:0`
- `cohere.embed-multilingual-v3`
- `cohere.embed-english-v3`

#### 利用可能な再順位付けモデル

- `amazon.rerank-v1:0`
- `cohere.rerank-v3-5:0`

## エージェント設定

```typescript
env: {
  agentEnabled: true,                     // Code Interpreterエージェントの有効化
  searchAgentEnabled: true,               // 検索エージェントの有効化
  searchApiKey: "brave-api-key-xxx",      // 検索API キー
  searchEngine: "Brave",                  // 検索エンジン（"Brave" | "Tavily"）
  agents: [                               // カスタムエージェント
    {
      displayName: "Customer Support Agent",
      agentId: "AGENT123",
      aliasId: "ALIAS123"
    }
  ],
  inlineAgents: false,                    // インラインエージェント機能
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `agentEnabled` | boolean | `false` | Code Interpreterエージェントの有効化 |
| `searchAgentEnabled` | boolean | `false` | Web検索エージェントの有効化 |
| `searchApiKey` | string | null | 検索エンジンのAPIキー |
| `searchEngine` | "Brave" \| "Tavily" | `"Brave"` | 使用する検索エンジン |
| `agents` | AgentConfig[] | `[]` | 追加するカスタムエージェントのリスト |
| `inlineAgents` | boolean | `false` | インラインエージェント機能の有効化 |

## フロー・機能制御

### ユースケースの表示制御

```typescript
env: {
  hiddenUseCases: {                       // 非表示にするユースケース
    generate: false,                      // テキスト生成
    summarize: true,                      // 要約（非表示）
    writer: false,                        // ライティング
    translate: false,                     // 翻訳
    webContent: true,                     // Webコンテンツ（非表示）
    image: false,                         // 画像生成
    video: true,                         // 動画生成（非表示）
    videoAnalyzer: false,                // 動画分析
    diagram: false,                      // 図表生成
    meetingMinutes: false,               // 議事録生成
    voiceChat: false,                    // 音声チャット
  },
}
```

### フロー設定

```typescript
env: {
  flows: [                                // Prompt Flowsの設定
    {
      flowId: "FLOW123",
      aliasId: "ALIAS123", 
      flowName: "Document Processing",
      description: "Automated document processing flow"
    }
  ],
}
```

### その他機能

```typescript
env: {
  mcpEnabled: false,                      // MCP（Model Context Protocol）
  guardrailEnabled: true,                 // Guardrail機能
  useCaseBuilderEnabled: true,            // ユースケースビルダー
  dashboard: true,                        // ダッシュボード機能
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `hiddenUseCases` | HiddenUseCases | `{}` | 非表示にするユースケースの指定 |
| `flows` | FlowConfig[] | `[]` | Prompt Flowsの設定リスト |
| `mcpEnabled` | boolean | `false` | Model Context Protocolの有効化 |
| `guardrailEnabled` | boolean | `false` | Guardrail機能の有効化 |
| `useCaseBuilderEnabled` | boolean | `true` | ユースケースビルダーの有効化 |
| `dashboard` | boolean | `false` | ダッシュボード機能の有効化 |

## ネットワーク・セキュリティ

### WAF（Web Application Firewall）設定

```typescript
env: {
  allowedIpV4AddressRanges: [             // 許可するIPv4アドレス範囲
    "192.168.1.0/24",
    "10.0.0.0/8"
  ],
  allowedIpV6AddressRanges: [             // 許可するIPv6アドレス範囲
    "2001:db8::/32"
  ],
  allowedCountryCodes: ["JP", "US"],      // 許可する国コード
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `allowedIpV4AddressRanges` | string[] | null | アクセスを許可するIPv4 CIDR範囲 |
| `allowedIpV6AddressRanges` | string[] | null | アクセスを許可するIPv6 CIDR範囲 |
| `allowedCountryCodes` | string[] | null | アクセスを許可する国コード（ISO 3166-1 alpha-2） |

## カスタムドメイン・インフラ

```typescript
env: {
  hostName: "ai-assistant",               // サブドメイン名
  domainName: "company.com",              // 独自ドメイン名
  hostedZoneId: "Z123456789",             // Route 53 ホストゾーンID
}
```

| パラメータ | 型 | デフォルト | 説明 |
|-----------|----|-----------|----- |
| `hostName` | string | null | カスタムドメインのホスト名（サブドメイン部分） |
| `domainName` | string | null | カスタムドメイン名 |
| `hostedZoneId` | string | null | Route 53のホストゾーンID |

## 環境別設定例

### 開発環境（dev）

```typescript
dev: {
  region: "ap-northeast-1",
  selfSignUpEnabled: true,                // 開発者の自由な登録を許可
  ragEnabled: false,                      // RAG機能は無効でシンプルに
  agentEnabled: false,                    // エージェント機能も無効
  dashboard: true,                        // 開発状況の確認用
  anonymousUsageTracking: false,          // プライバシー重視
  modelIds: [
    "us.anthropic.claude-3-5-haiku-20241022-v1:0" // 低コストモデル
  ],
  hiddenUseCases: {
    video: true,                          // 高コスト機能は非表示
    image: true,
  }
}
```

### ステージング環境（staging）

```typescript
staging: {
  region: "ap-northeast-1",
  selfSignUpEnabled: false,               // 承認制
  ragEnabled: true,                       // RAG機能をテスト
  kendraIndexLanguage: "ja",
  agentEnabled: true,                     // エージェント機能をテスト
  guardrailEnabled: true,                 // セキュリティ機能を検証
  allowedIpV4AddressRanges: [            // 社内ネットワークのみ
    "10.0.0.0/8",
    "192.168.0.0/16"
  ],
  modelIds: [
    "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "us.amazon.nova-pro-v1:0"
  ],
  dashboard: true,                        // 監視用
}
```

### 本番環境（prod）

```typescript
prod: {
  region: "ap-northeast-1",
  selfSignUpEnabled: false,               // セキュリティ重視
  samlAuthEnabled: true,                  // 企業認証との連携
  samlCognitoDomainName: "auth-prod",
  samlCognitoFederatedIdentityProviderName: "company-saml",
  
  // RAG機能フル活用
  ragEnabled: true,
  ragKnowledgeBaseEnabled: true,
  ragKnowledgeBaseStandbyReplicas: true,  // 高可用性
  embeddingModelId: "amazon.titan-embed-text-v2:0",
  queryDecompositionEnabled: true,
  rerankingModelId: "cohere.rerank-v3-5:0",
  
  // エージェント機能
  agentEnabled: true,
  searchAgentEnabled: true,
  searchEngine: "Brave",
  
  // セキュリティ強化
  guardrailEnabled: true,
  allowedCountryCodes: ["JP"],            // 日本からのみアクセス許可
  
  // カスタムドメイン
  hostName: "ai-assistant",
  domainName: "company.com",
  hostedZoneId: "Z123456789",
  
  // 本番用モデル
  modelIds: [
    "us.anthropic.claude-sonnet-4-20250514-v1:0",
    "us.amazon.nova-premier-v1:0"
  ],
  
  // 監視・追跡
  dashboard: false,                       // 外部からの情報露出を最小化
  anonymousUsageTracking: false,          // プライバシー重視
}
```

## 設定変更時の注意事項

### デプロイ方法

```bash
# 特定環境でのデプロイ
npm run cdk:deploy -- -c env=prod

# または deploy.sh使用
./deploy.sh -e prod
```

### 破壊的変更を伴う設定

以下の設定変更時は、既存リソースの削除・再作成が必要です：

- `embeddingModelId`
- `ragKnowledgeBaseStandbyReplicas`  
- `ragKnowledgeBaseAdvancedParsing`
- `ragKnowledgeBaseBinaryVector`

### セキュリティベストプラクティス

1. **本番環境では必ず `selfSignUpEnabled: false`**
2. **WAF設定でアクセス範囲を制限**
3. **SAML認証の活用**
4. **Guardrail機能の有効化**
5. **不要な機能の無効化**

この設定ガイドを参考に、環境に応じた適切な設定を行ってください。