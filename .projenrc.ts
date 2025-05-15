import {
  GithubCredentials,
  PulumiEscSetup,
  TypeScriptProject,
} from '@hallcor/pulumi-projen-project-types';
import {
  NodePackageManager,
  UpgradeDependenciesSchedule,
} from 'projen/lib/javascript';

const project = new TypeScriptProject({
  defaultReleaseBranch: 'main',
  sampleCode: false,
  name: '@hallcor/pulumi-component-utils',
  projenrcTs: true,
  depsUpgradeOptions: {
    workflowOptions: {
      branches: ['main'],
      labels: ['auto-approve'],
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
  },
  autoApproveOptions: {
    label: 'auto-approve',
    allowedUsernames: ['corymhall', 'hallcor-projen-app[bot]'],
  },
  projenCredentials: GithubCredentials.fromApp({
    pulumiEscSetup: PulumiEscSetup.fromOidcAuth({
      environment: 'github/public',
      organization: 'corymhall',
    }),
  }),
  packageManager: NodePackageManager.NPM,
  devDeps: ['@hallcor/pulumi-projen-project-types', '@types/deep-equal'],
  deps: ['@pulumi/pulumi', 'deep-equal'],
});
project.synth();
