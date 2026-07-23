import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { s3Credentials } from "@/lib/s3-credentials";

// A escolha da cadeia de credenciais é o que separa Vercel de ECS:
//  - Vercel não tem cadeia padrão do SDK (sem task role, sem IMDS) —
//    precisa federar via OIDC.
//  - ECS/dev local ainda dependem da cadeia padrão. Passar `undefined`
//    é o que faz o SDK cair no credentialDefaultProvider.
// Um erro aqui só aparece em runtime, no upload — daí o teste.

vi.mock("@vercel/oidc-aws-credentials-provider", () => ({
  awsCredentialsProvider: vi.fn(() => async () => ({
    accessKeyId: "AKIA_FAKE",
    secretAccessKey: "fake",
  })),
}));

const ORIGINAL_ENV = { ...process.env };
const ROLE_ARN = "arn:aws:iam::507099297746:role/autostand-vercel-s3";

describe("s3Credentials", () => {
  beforeEach(() => {
    vi.mocked(awsCredentialsProvider).mockClear();
    delete process.env.AWS_ROLE_ARN;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sem AWS_ROLE_ARN, deixa a cadeia padrão do SDK (ECS task role / dev local)", () => {
    expect(s3Credentials()).toBeUndefined();
    expect(awsCredentialsProvider).not.toHaveBeenCalled();
  });

  it("com AWS_ROLE_ARN, federa via OIDC do Vercel", () => {
    process.env.AWS_ROLE_ARN = ROLE_ARN;
    const creds = s3Credentials();
    expect(typeof creds).toBe("function");
    expect(awsCredentialsProvider).toHaveBeenCalledTimes(1);
    expect(awsCredentialsProvider).toHaveBeenCalledWith({ roleArn: ROLE_ARN });
  });

  it("não passa `audience` — o default (https://vercel.com/<team>) é o que a trust policy exige", () => {
    process.env.AWS_ROLE_ARN = ROLE_ARN;
    s3Credentials();
    const init = vi.mocked(awsCredentialsProvider).mock.calls[0][0];
    expect(init).not.toHaveProperty("audience");
  });

  it("trata AWS_ROLE_ARN vazia como ausente", () => {
    process.env.AWS_ROLE_ARN = "";
    expect(s3Credentials()).toBeUndefined();
    expect(awsCredentialsProvider).not.toHaveBeenCalled();
  });
});
