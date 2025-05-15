import * as pulumi from '@pulumi/pulumi';
import { ID } from '@pulumi/pulumi';
import { DiffResult } from '@pulumi/pulumi/provider';
import deepEqual from 'deep-equal';
import { CreateResult, ReadResult, UpdateResult } from './types';
import { URN } from './urn';

/**
 * The arguments (i.e. inputs) to the state store resource
 */
export interface StateStoreArgs {
  /**
   * The values to store in the state store
   */
  values: Record<string, pulumi.Input<string>>;

  /**
   * Whether to update the state store values on refresh
   *
   * @default false
   * TODO: this should be a plain boolean
   */
  updateOnRefresh?: pulumi.Input<boolean>;

  /**
   * Values that will trigger an update to the returned values
   * if changed.
   *
   * @default - nothing will trigger an update
   */
  triggers?: { [key: string]: pulumi.Input<string> };
}

/**
 * The properties (i.e. output) of the state store resource
 */
export interface StateStoreProperties extends StateStoreArgs {
  shouldUpdate?: boolean;
}

export function stateProviderFactory(): pulumi.provider.Provider {
  return {
    version: '',

    read: async (
      id: pulumi.ID,
      urn: pulumi.URN,
      // props is the prior state. It will only be available on `refresh`
      // and will be empty on `import`
      props: StateStoreProperties,
    ): Promise<ReadResult<StateStoreArgs, StateStoreProperties>> => {
      if (!props || Object.keys(props).length === 0) {
        throw new Error(`Import is not supported for ${urn} resource`);
      }
      return {
        id,
        props: {
          values: props.values,
          shouldUpdate: props.updateOnRefresh === true,
        },
      };
    },
    delete: async (
      _id: pulumi.ID,
      _urn: pulumi.URN,
      _props: any,
    ): Promise<void> => {
      return;
    },
    create: async (
      urn: pulumi.URN,
      inputs: any,
    ): Promise<CreateResult<StateStoreProperties>> => {
      return {
        id: URN.parse(urn).name,
        outs: inputs,
      };
    },
    update: async (
      _id,
      _urn,
      olds: StateStoreProperties,
      news: StateStoreArgs,
    ): Promise<UpdateResult<StateStoreProperties>> => {
      // if we are updating just return all the new values
      if (olds.shouldUpdate) {
        return {
          outs: news,
        };
      }

      // we'll only be in an update if shouldUpdate is true
      // or if triggers have changed
      if (olds.triggers || news.triggers) {
        return {
          outs: news,
        };
      }
      // if we are not updating then return the old values for existing records
      // and new values for the new records
      const newValues: Record<string, pulumi.Input<string>> = {
        ...olds.values,
      };
      for (const [key, value] of Object.entries(news.values)) {
        if (!(key in newValues)) {
          newValues[key] = value;
        }
      }

      return {
        outs: {
          values: newValues,
        },
      };
    },
    diff: async (
      _id: ID,
      _urn: pulumi.URN,
      // olds are the old state
      olds: StateStoreProperties,
      // news are the new inputs
      news: StateStoreArgs,
    ): Promise<DiffResult> => {
      // do a diff if we have refreshed
      let changes = false;
      if (olds.shouldUpdate) {
        if (!deepEqual(news.values, olds.values)) {
          changes = true;
        }
      }
      // or if the triggers have changed
      if (olds.triggers || news.triggers) {
        const triggersChanged = !deepEqual(news.triggers, olds.triggers);
        const changed = !deepEqual(news.values, olds.values);
        if (triggersChanged && changed) {
          changes = true;
        }
      }
      return {
        changes,
      };
    },
  };
}

/**
 * StateStore is a component resource that stores values that can remain
 * stable across updates. Any inputs to the state store will be available
 * as outputs. The output values will be the initial value of the inputs.
 *
 * Optionally, if `updateOnRefresh` is set to true, the state store will
 * update the values on refresh. This is useful for storing values that you
 * want to be able to update, but only when you explicitly refresh the stack.
 */
export class StateStore extends pulumi.ComponentResource {
  public readonly values: pulumi.Output<Record<string, pulumi.Output<string>>>;
  constructor(
    packageName: string,
    name: string,
    args: StateStoreArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super(`${packageName}:index:StateStore`, name, args, opts);
    const state = new StateStoreResource(packageName, name, args, {
      parent: this,
    });
    this.values = state.values;

    this.registerOutputs({
      values: state.values,
    });
  }
}

export class StateStoreResource extends pulumi.CustomResource {
  public readonly values!: pulumi.Output<Record<string, pulumi.Output<string>>>;
  constructor(
    packageName: string,
    name: string,
    args: StateStoreArgs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    super(`${packageName}:index:StateStoreResource`, name, args, opts);
  }
}
