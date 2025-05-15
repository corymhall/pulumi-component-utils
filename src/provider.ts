import { readFileSync } from 'fs';
import * as path from 'path';
import * as pulumi from '@pulumi/pulumi';
import {
  ComponentProvider,
  ComponentProviderOptions,
} from '@pulumi/pulumi/provider/experimental';
import { PackageSpec } from '@pulumi/pulumi/provider/experimental/schema';
import { stateProviderFactory } from './state-store';
import { URN } from './urn';

export function componentProviderHost(
  options: ComponentProviderOptions,
  providerFactory?: ProviderFactory,
): Promise<void> {
  const args = process.argv.slice(2);
  // If dirname is not provided, get it from the call stack
  if (!options.dirname) {
    // Get the stack trace
    const stack = new Error().stack;
    // Parse the stack to get the caller's file
    // Stack format is like:
    // Error
    //     at componentProviderHost (.../src/index.ts:3:16)
    //     at Object.<anonymous> (.../caller/index.ts:4:1)
    const callerLine = stack?.split('\n')[2];
    const match = callerLine?.match(/\((.+):[0-9]+:[0-9]+\)/);
    if (match?.[1]) {
      options.dirname = path.dirname(match[1]);
    } else {
      throw new Error('Could not determine caller directory');
    }
  }

  const absDir = path.resolve(options.dirname);
  const packStr = readFileSync(`${absDir}/package.json`, { encoding: 'utf-8' });
  const packageJSON = JSON.parse(packStr);
  const matches = packageJSON.name.match(/(@.*?\/)?(.+)/);
  const providerName = matches[2];
  let namespace = undefined;
  if (matches[1]) {
    namespace = matches[1].substring(1, matches[1].length - 1);
  }
  if (!options.name) {
    options.name = providerName;
  }

  if (!options.namespace) {
    options.namespace = namespace;
  }

  const prov = new Provider(options, providerFactory);
  return pulumi.provider.main(prov, args);
}

// A map of types to provider factories. Calling a factory may return a new instance each
// time or return the same provider instance.
export type ProviderFactory = Record<string, () => pulumi.provider.Provider>;

export class Provider extends ComponentProvider {
  private readonly _name: string;
  private readonly stateStoreResourceToken: string;
  constructor(
    options: ComponentProviderOptions,
    private readonly typeToProviderFactoryMap: ProviderFactory = {},
  ) {
    super(options);

    this._name = options.name;
    this.stateStoreResourceToken = `${this._name}:index:StateStoreResource`;
    this.typeToProviderFactoryMap[this.stateStoreResourceToken] =
      stateProviderFactory;
  }

  async call(
    token: string,
    _inputs: pulumi.Inputs,
  ): Promise<pulumi.provider.InvokeResult> {
    throw new Error(`resource methods not supported ${token}`);
  }

  async getSchema(): Promise<string> {
    const superSchema = await super.getSchema();
    const jsonSchema: PackageSpec = JSON.parse(superSchema);
    jsonSchema.resources[this.stateStoreResourceToken] = {
      isComponent: false,
      properties: {
        values: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
      type: 'object',
      description: 'A state store resource',
      inputProperties: {
        updateOnRefresh: {
          type: 'boolean',
          plain: true,
        },
        values: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
      requiredInputs: ['values'],
      required: ['values'],
    };
    return JSON.stringify(jsonSchema);
  }

  async invoke(
    token: string,
    _inputs: pulumi.Inputs,
  ): Promise<pulumi.provider.InvokeResult> {
    throw new Error(`function invocations not supported: ${token}`);
  }

  check(
    urn: pulumi.URN,
    olds: any,
    news: any,
  ): Promise<pulumi.provider.CheckResult> {
    const provider = this.getProviderForURN(urn);
    if (!provider) {
      return unknownResourceRejectedPromise(urn);
    }
    return provider.check
      ? provider.check(urn, olds, news)
      : Promise.resolve({ inputs: news, failures: [] });
  }

  diff(
    id: pulumi.ID,
    urn: pulumi.URN,
    olds: any,
    news: any,
  ): Promise<pulumi.provider.DiffResult> {
    const provider = this.getProviderForURN(urn);
    if (!provider) {
      return unknownResourceRejectedPromise(urn);
    }
    return provider.diff
      ? provider.diff(id, urn, olds, news)
      : Promise.resolve({});
  }

  create(urn: pulumi.URN, inputs: any): Promise<pulumi.provider.CreateResult> {
    const provider = this.getProviderForURN(urn);
    return provider?.create
      ? provider.create(urn, inputs)
      : unknownResourceRejectedPromise(urn);
  }

  read(
    id: pulumi.ID,
    urn: pulumi.URN,
    props?: any,
  ): Promise<pulumi.provider.ReadResult> {
    const provider = this.getProviderForURN(urn);
    if (!provider) {
      return unknownResourceRejectedPromise(urn);
    }
    return provider.read
      ? provider.read(id, urn, props)
      : Promise.resolve({ id, props });
  }

  update(
    id: pulumi.ID,
    urn: pulumi.URN,
    olds: any,
    news: any,
  ): Promise<pulumi.provider.UpdateResult> {
    const provider = this.getProviderForURN(urn);
    if (!provider) {
      return unknownResourceRejectedPromise(urn);
    }
    return provider.update
      ? provider.update(id, urn, olds, news)
      : Promise.resolve({ outs: news });
  }

  delete(id: pulumi.ID, urn: pulumi.URN, props: any): Promise<void> {
    const provider = this.getProviderForURN(urn);
    if (!provider) {
      return unknownResourceRejectedPromise(urn);
    }
    return provider.delete
      ? provider.delete(id, urn, props)
      : Promise.resolve();
  }

  construct(
    name: string,
    type: string,
    inputs: pulumi.Inputs,
    options: pulumi.ComponentResourceOptions,
  ): Promise<pulumi.provider.ConstructResult> {
    return super.construct(name, type, inputs, options);
  }

  /**
   * Returns a provider for the URN or undefined if not found.
   */
  private getProviderForURN(
    urn: pulumi.URN,
  ): pulumi.provider.Provider | undefined {
    const type = URN.parse(urn).type;
    return this.getProviderForType(type);
  }

  /**
   * Returns a provider for the type or undefined if not found.
   */
  private getProviderForType(
    type: string,
  ): pulumi.provider.Provider | undefined {
    const factory = this.typeToProviderFactoryMap[type];
    return factory ? factory() : undefined;
  }
}

function unknownResourceRejectedPromise<T>(type: string): Promise<T> {
  return Promise.reject(new Error(`unknown resource type ${type}`));
}
