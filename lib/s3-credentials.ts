import type { S3ClientConfig } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

/**
 * Cadeia de credenciais do S3 — pura, sem `server-only`, pra ser testável.
 *
 * Vercel: a cadeia padrão do SDK não existe lá (sem task role, sem IMDS),
 * então os uploads quebrariam. Com `AWS_ROLE_ARN` definida, federamos via
 * OIDC do Vercel: o token da function é trocado por credenciais temporárias
 * da role (STS AssumeRoleWithWebIdentity), sem chave estática no ambiente.
 * A `audience` fica no default (`https://vercel.com/<team>`) — é exatamente
 * o que a trust policy da role exige; passar uma custom quebraria o assume.
 *
 * ECS/dev local: sem `AWS_ROLE_ARN`, retorna `undefined` e o S3Client cai no
 * `credentialDefaultProvider` (task role no Fargate, ~/.aws no dev). O ECS
 * ainda está no ar durante a migração — esse fallback não é opcional.
 */
export function s3Credentials(): S3ClientConfig["credentials"] {
  const roleArn = process.env.AWS_ROLE_ARN;
  if (!roleArn) return undefined;
  return awsCredentialsProvider({ roleArn });
}
