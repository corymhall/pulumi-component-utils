import * as pulumi from '@pulumi/pulumi';

export interface BaseProperties<T> {
  __inputs: T;
}

export type CreateResult<T> = Omit<pulumi.provider.CreateResult, 'outs'> & {
  outs: T;
};

export type UpdateResult<T> = Omit<pulumi.provider.UpdateResult, 'outs'> & {
  outs: T;
};

export type ReadResult<T, P> = Omit<
  pulumi.provider.ReadResult,
  'inputs' | 'props'
> & {
  inputs?: T;
  props?: P;
};
