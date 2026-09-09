import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, test } from 'vitest';

const workflow = readFileSync(resolve(__dirname, '../../.github/workflows/ci.yml'), 'utf-8');
const cnJob = workflow.split('\n  deploy-cn-test:\n', 2)[1];
const legacy = readFileSync(resolve(__dirname, '../../.github/workflows/deploy-test.yml'), 'utf-8');

describe('China Test deployment workflow', () => {
  test('runs after every main CI gate on a native ARM64 runner', () => {
    expect(workflow).toContain('on:\n  workflow_dispatch:\n  push:');
    expect(cnJob).toContain("github.ref == 'refs/heads/main'");
    expect(cnJob).toContain(
      "github.event_name == 'push' || github.event_name == 'workflow_dispatch'",
    );
    expect(cnJob).toContain('needs: [check, render-service, e2e]');
    expect(cnJob).toContain('runs-on: [self-hosted, Linux, ARM64, botlearn-runner-us]');
    expect(cnJob).toContain('fetch-depth: 0');
    expect(cnJob).toContain('test "$GITHUB_REF" = refs/heads/main');
    expect(cnJob).toContain('test "$(uname -m)" = aarch64');
  });

  test('publishes only an immutable ARM64 candidate', () => {
    expect(cnJob).toContain('ECR_REPOSITORY: open/open-maic');
    expect(cnJob).toContain('CANDIDATE_TAG: cn-test-${{ github.sha }}');
    expect(cnJob).toContain('Resolve immutable candidate');
    expect(cnJob).toContain('echo "exists=true" >> "$GITHUB_OUTPUT"');
    expect(cnJob).toContain('echo "exists=false" >> "$GITHUB_OUTPUT"');
    expect(cnJob).toContain('test "$failure_code" = ImageNotFound');
    expect(cnJob).toContain("if: steps.candidate.outputs.exists != 'true'");
    expect(cnJob).toContain('Reusing immutable candidate');
    expect(cnJob).toContain('docker buildx build --platform linux/arm64 --push');
    expect(cnJob).toContain('--build-arg NEXT_PUBLIC_PERSISTENCE=1');
    expect(cnJob).toContain('--label "org.opencontainers.image.revision=$GITHUB_SHA"');
    expect(cnJob).not.toContain(':test');
    expect(cnJob).not.toContain(':prod');
    expect(cnJob).not.toContain(':latest');
  });

  test('hands the candidate to the reviewed DevOps action', () => {
    expect(cnJob).toContain('client-id: ${{ vars.DEVOPS_PR_APP_CLIENT_ID }}');
    expect(cnJob).toContain('private-key: ${{ secrets.DEVOPS_PR_APP_PRIVATE_KEY }}');
    expect(cnJob).toContain('repository: readai-team/aibrary-devops');
    expect(cnJob).toContain('permission-contents: read');
    expect(cnJob).toContain('persist-credentials: false');
    expect(cnJob).toContain('uses: ./.devops/.github/actions/deploy-test-cn');
    expect(cnJob).toContain('product: open-maic');
    expect(cnJob).toContain('source-sha: ${{ github.sha }}');
    expect(cnJob).toContain('source-directory: .');
  });

  test('removes buildx before deleting its isolated Docker config', () => {
    const setup = cnJob
      .split('- name: Set up Docker Buildx', 2)[1]
      .split('- name: Log in to China ECR', 2)[0];
    const cleanup = cnJob.split('- name: Cleanup isolated Docker state', 2)[1];

    expect(setup).toContain('id: buildx');
    expect(setup).toContain('cleanup: false');
    expect(setup).toContain('cache-binary: false');
    expect(cleanup.indexOf('docker buildx rm "${{ steps.buildx.outputs.name }}"')).toBeLessThan(
      cleanup.indexOf('rm -rf -- "$DOCKER_CONFIG"'),
    );
  });

  test('keeps the legacy manual publisher US-only', () => {
    const dispatch = legacy.split('workflow_dispatch:', 2)[1].split('env:', 2)[0];
    expect(dispatch).toContain('default: us');
    expect(dispatch).toContain('          - us\n');
    expect(dispatch).not.toContain('          - cn\n');
    expect(dispatch).not.toContain('          - both\n');
    expect(legacy).not.toContain('ECR_CN_REPOSITORY');
    expect(legacy).not.toContain('Push to CN ECR');
    expect(legacy).not.toContain('dkr.ecr.cn-northwest-1.amazonaws.com.cn');
  });
});
