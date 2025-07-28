# ローカル開発環境完全ガイド

このドキュメントでは、GenU（Generative AI Use Cases）のローカル開発環境の構築から運用まで、開発者が知っておくべき全ての情報を包括的に説明します。

## 目次

- [前提条件](#前提条件)
- [クイックスタート](#クイックスタート)
- [プラットフォーム別セットアップ](#プラットフォーム別セットアップ)
- [環境の切り替え](#環境の切り替え)
- [環境変数リファレンス](#環境変数リファレンス)
- [トラブルシューティング](#トラブルシューティング)
- [開発ワークフロー](#開発ワークフロー)
- [高度な設定](#高度な設定)

## 前提条件

### 必須要件

1. **AWSへのデプロイ完了**
   - GenUがAWSにデプロイされている必要があります
   - CloudFormationスタックが正常に作成されていること
   - [デプロイ手順](DEPLOY_ON_AWS.md)を参照

2. **必要なツール**
   - [Node.js](https://nodejs.org/) (v18以上推奨)
   - [AWS CLI](https://aws.amazon.com/cli/) v2 (認証設定済み)
   - [jq](https://jqlang.github.io/jq/) (Unix系環境のみ)

3. **AWS認証**
   - AWS CLIの認証設定が完了していること
   - 対象のAWSアカウント・リージョンへのアクセス権限

### 推奨環境

- **Unix系OS**: macOS, Linux, Windows WSL
- **エディタ**: VS Code (推奨拡張機能あり)
- **ブラウザ**: Chrome, Firefox, Safari, Edge

## クイックスタート

最も簡単な方法でローカル開発環境を起動します：

```bash
# リポジトリのクローン（初回のみ）
git clone <repository-url>
cd my-gen-ai-usecase

# 依存関係のインストール（初回のみ）
npm ci

# ローカル開発サーバーの起動
npm run web:devw
```

成功すると http://localhost:5173 でアプリケーションにアクセスできます。

## プラットフォーム別セットアップ

### Unix系環境（推奨）

**対象**: macOS, Linux, Windows WSL, Git Bash, Cloud9

```bash
# 自動環境変数設定 + 開発サーバー起動
npm run web:devw

# 特定の環境を指定する場合
npm run web:devw --env=dev2
```

**使用するスクリプト**: `setup-env.sh`

**必要なツール**:
- `aws` コマンド
- `jq` コマンド

### Windows環境

**対象**: Windows PowerShell, Command Prompt

```powershell
# PowerShell用スクリプトで起動
npm run web:devww

# プロファイルを指定する場合
npm run web:devww -- -profile myprofile

# 環境を指定する場合
npm run web:devww -- -env prod
```

**使用するスクリプト**: `web_devw_win.ps1`

**必要なツール**:
- `aws` コマンド
- PowerShell 5.1以上

> [!NOTE]
> Windows環境では引数指定時に `--` をシングルクォートで囲む必要があります:
> ```powershell
> npm run web:devww '--' -profile dev -env staging
> ```

### 手動設定

自動スクリプトが使用できない場合の手動設定方法：

```bash
# .envファイルの作成
cp packages/web/.env.example packages/web/.env

# 環境変数を手動設定（.envファイルを編集）
# または直接エクスポート
export VITE_APP_API_ENDPOINT=https://xxx.execute-api.ap-northeast-1.amazonaws.com/api/
export VITE_APP_REGION=ap-northeast-1
# ... 他の環境変数

# 開発サーバー起動
npm run web:dev
```

## 環境の切り替え

### 環境名の指定

```bash
# デフォルト環境（cdk.jsonで指定された環境）
npm run web:devw

# 開発環境
npm run web:devw --env=dev

# ステージング環境  
npm run web:devw --env=staging

# 本番環境
npm run web:devw --env=prod

# カスタム環境
npm run web:devw --env=dev2
```

### プロファイルの切り替え

```bash
# Unix系環境
export AWS_PROFILE=myprofile
npm run web:devw

# Windows環境
npm run web:devww -- -profile myprofile
```

### 環境とプロファイルの組み合わせ

```bash
# Unix系
AWS_PROFILE=staging npm run web:devw --env=staging

# Windows
npm run web:devww -- -profile staging -env staging
```

## 環境変数リファレンス

ローカル開発で使用される主要な環境変数とその説明：

### 基本設定

| 環境変数 | 説明 | 例 |
|---------|------|---|
| `VITE_APP_VERSION` | アプリケーションバージョン | `"4.3.2"` |
| `VITE_APP_API_ENDPOINT` | バックエンドAPIエンドポイント | `"https://xxx.execute-api.ap-northeast-1.amazonaws.com/api/"` |
| `VITE_APP_REGION` | AWSリージョン | `"ap-northeast-1"` |

### 認証関連

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_USER_POOL_ID` | Cognito User PoolのID | `UserPoolId` |
| `VITE_APP_USER_POOL_CLIENT_ID` | Cognito User Pool ClientのID | `UserPoolClientId` |
| `VITE_APP_IDENTITY_POOL_ID` | Cognito Identity PoolのID | `IdPoolId` |
| `VITE_APP_SELF_SIGN_UP_ENABLED` | セルフサインアップの有効化 | `SelfSignUpEnabled` |

### SAML認証

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_SAMLAUTH_ENABLED` | SAML認証の有効化 | `SamlAuthEnabled` |
| `VITE_APP_SAML_COGNITO_DOMAIN_NAME` | SAMLドメイン名 | `SamlCognitoDomainName` |
| `VITE_APP_SAML_COGNITO_FEDERATED_IDENTITY_PROVIDER_NAME` | SAML IDプロバイダ名 | `SamlCognitoFederatedIdentityProviderName` |

### モデル設定

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_MODEL_REGION` | モデルが利用可能なリージョン | `ModelRegion` |
| `VITE_APP_MODEL_IDS` | 利用可能なテキストモデルID一覧（JSON） | `ModelIds` |
| `VITE_APP_IMAGE_MODEL_IDS` | 画像生成モデルID一覧（JSON） | `ImageGenerateModelIds` |
| `VITE_APP_VIDEO_MODEL_IDS` | 動画生成モデルID一覧（JSON） | `VideoGenerateModelIds` |
| `VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS` | 音声変換モデルID一覧（JSON） | `SpeechToSpeechModelIds` |
| `VITE_APP_ENDPOINT_NAMES` | カスタムエンドポイント名一覧（JSON） | `EndpointNames` |

### RAG機能

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_RAG_ENABLED` | Kendra RAGの有効化 | `RagEnabled` |
| `VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED` | Knowledge Base RAGの有効化 | `RagKnowledgeBaseEnabled` |

### エージェント機能

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_AGENT_ENABLED` | エージェント機能の有効化 | `AgentEnabled` |
| `VITE_APP_AGENT_NAMES` | 利用可能なエージェント名一覧（Base64エンコード） | `AgentNames` |
| `VITE_APP_INLINE_AGENTS` | インラインエージェントの有効化 | `InlineAgents` |

### Lambda関数

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_PREDICT_STREAM_FUNCTION_ARN` | 予測ストリーム関数のARN | `PredictStreamFunctionArn` |
| `VITE_APP_FLOW_STREAM_FUNCTION_ARN` | フローストリーム関数のARN | `InvokeFlowFunctionArn` |
| `VITE_APP_OPTIMIZE_PROMPT_FUNCTION_ARN` | プロンプト最適化関数のARN | `OptimizePromptFunctionArn` |

### フロー・設定

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_FLOWS` | 利用可能なフロー一覧（Base64デコード後JSON） | `Flows` |
| `VITE_APP_USE_CASE_BUILDER_ENABLED` | ユースケースビルダーの有効化 | `UseCaseBuilderEnabled` |
| `VITE_APP_HIDDEN_USE_CASES` | 非表示にするユースケース（JSON） | `HiddenUseCases` |

### 音声機能

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_SPEECH_TO_SPEECH_NAMESPACE` | 音声変換の名前空間 | `SpeechToSpeechNamespace` |
| `VITE_APP_SPEECH_TO_SPEECH_EVENT_API_ENDPOINT` | 音声イベントAPIエンドポイント | `SpeechToSpeechEventApiEndpoint` |

### MCP（Model Context Protocol）

| 環境変数 | 説明 | CloudFormation Output |
|---------|------|---------------------|
| `VITE_APP_MCP_ENABLED` | MCP機能の有効化 | `McpEnabled` |
| `VITE_APP_MCP_ENDPOINT` | MCPエンドポイント | `McpEndpoint` |

## トラブルシューティング

### よくある問題と解決方法

#### 1. スタックが見つからない

**エラー**: `No stack output found for stack: GenerativeAiUseCasesStackdev`

**原因**:
- 環境名が間違っている
- AWSリージョンが間違っている
- AWSプロファイルが間違っている

**解決方法**:
```bash
# スタック名を確認
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# 正しい環境名を指定
npm run web:devw --env=correct-env-name

# プロファイル・リージョンを確認
aws configure list
```

#### 2. AWS CLI認証エラー

**エラー**: `Unable to locate credentials`

**解決方法**:
```bash
# AWS CLIの設定確認
aws configure list

# プロファイルの設定
aws configure --profile myprofile

# 環境変数での認証
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_DEFAULT_REGION=ap-northeast-1
```

#### 3. jqコマンドが見つからない

**エラー**: `command not found: jq`

**解決方法**:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Windows WSL
sudo apt-get install jq

# または手動設定を使用
npm run web:dev  # .envファイル設定後
```

#### 4. 開発サーバーが起動しない

**症状**: `npm run web:devw`が失敗する

**解決方法**:
```bash
# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm ci

# キャッシュクリア
npm run web:dev -- --force

# 手動で環境変数を確認
echo $VITE_APP_API_ENDPOINT
```

#### 5. CORS エラー

**症状**: ブラウザでCORSエラーが発生

**原因**: API GatewayのCORS設定
**解決方法**: バックエンドのCORS設定を確認・修正

#### 6. Windows環境での引数エラー

**エラー**: 引数が正しく認識されない

**解決方法**:
```powershell
# 正しい記法
npm run web:devww '--' -profile dev -env staging

# 間違った記法
npm run web:devww -- -profile dev  # NGS
```

### デバッグ手順

#### 1. 環境変数の確認

```bash
# Unix系環境
env | grep VITE_APP_

# Windows PowerShell
Get-ChildItem Env: | Where-Object Name -like "VITE_APP_*"
```

#### 2. CloudFormation Output確認

```bash
# スタックの出力を直接確認
aws cloudformation describe-stacks --stack-name GenerativeAiUseCasesStack --query 'Stacks[0].Outputs'

# 特定の環境のスタック
aws cloudformation describe-stacks --stack-name GenerativeAiUseCasesStackdev --query 'Stacks[0].Outputs'
```

#### 3. ネットワーク設定確認

```bash
# API エンドポイントへの接続確認
curl -I $VITE_APP_API_ENDPOINT

# DNS解決確認
nslookup api-endpoint-domain.amazonaws.com
```

## 開発ワークフロー

### 基本的な開発フロー

```bash
# 1. 最新コードを取得
git pull origin main

# 2. ブランチ作成
git checkout -b feature/new-feature

# 3. 依存関係の更新（必要に応じて）
npm ci

# 4. ローカル開発開始
npm run web:devw

# 5. 開発・テスト
# ブラウザで http://localhost:5173 にアクセス

# 6. コード品質チェック
npm run lint
npm run web:test

# 7. CDK変更がある場合
npm run cdk:test
npm run cdk:test:update-snapshot  # 必要に応じて

# 8. コミット
git add .
git commit -m "feat: add new feature"

# 9. プッシュ・PR作成
git push origin feature/new-feature
```

### コード品質チェック

```bash
# Lint実行
npm run lint

# Web テスト実行
npm run web:test

# CDK テスト実行
npm run cdk:test

# 全体のビルドテスト
npm run web:build
```

### Pull Request作成時の注意事項

1. **必須チェック**:
   - `npm run lint` が成功すること
   - テストが通ること
   - CDKの変更がある場合は、スナップショットテストを更新

2. **Lintエラーを無視したい場合**:
   ```bash
   git commit -m "WIP: draft changes" --no-verify
   ```

3. **CDK変更時のスナップショット更新**:
   ```bash
   # 差分確認
   npm run cdk:test
   
   # スナップショット更新
   npm run cdk:test:update-snapshot
   ```

## 高度な設定

### 環境固有の設定

#### 1. カスタム環境変数の追加

**setup-env.sh への追加**:
```bash
# setup-env.sh
export CUSTOM_ENV_VAR=$(extract_value "$stack_output" 'CustomOutputKey')
```

**Windows版への追加**:
```powershell
# web_devw_win.ps1
$env:CUSTOM_ENV_VAR = Extract-Value $stack_output "CustomOutputKey"
```

#### 2. プロキシ設定

```bash
# HTTP プロキシ設定
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1

npm run web:devw
```

#### 3. ポート変更

```bash
# 別のポートで起動
PORT=3000 npm run web:dev
```

### デバッグ設定

#### 1. Vite デバッグモード

```bash
# 詳細ログ出力
DEBUG=vite:* npm run web:dev

# 特定のデバッグカテゴリ
DEBUG=vite:hmr npm run web:dev
```

#### 2. ブラウザーデバッガ

開発者ツールで以下を確認：
- Network タブ: API リクエスト/レスポンス
- Console タブ: JavaScript エラー
- Application タブ: LocalStorage の状態

#### 3. ソースマップ有効化

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    sourcemap: true,
  },
});
```

### パフォーマンス最適化

#### 1. 高速リロード設定

```javascript
// vite.config.ts
export default defineConfig({
  server: {
    hmr: {
      overlay: false,
    },
  },
});
```

#### 2. メモリ使用量の調整

```bash
# Node.js メモリ制限を増加
NODE_OPTIONS="--max-old-space-size=4096" npm run web:dev
```

### IDEとの連携

#### VS Code 推奨設定

**.vscode/settings.json**:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

**.vscode/extensions.json**:
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

## まとめ

このガイドでは、GenUローカル開発環境の構築から運用まで、開発者が効率的に作業するために必要な全ての情報を提供しました。

**クイックリファレンス**:
- **基本起動**: `npm run web:devw`
- **Windows**: `npm run web:devww`
- **環境切り替え**: `--env=環境名`
- **プロファイル指定**: `-profile プロファイル名` (Windows)
- **手動設定**: `.env`ファイル + `npm run web:dev`

問題が発生した場合は、[トラブルシューティング](#トラブルシューティング)セクションを参照してください。