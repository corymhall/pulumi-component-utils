/**
 * Each resource URN is of the form:
 *
 *	urn:pulumi:<Stack>::<Project>::<Qualified$Type$Name>::<Name>
 *	e.g. urn:pulumi:my-project::simple-example::res:index:MyComponent$res:index:MyResource::example
 *
 * wherein each element is the following:
 *
 *	<Stack>                 The stack being deployed into
 *	<Project>               The project being evaluated
 *	<Qualified$Type$Name>   The object type's qualified type token (including the parent type)
 *	<Name>                  The human-friendly name identifier assigned by the developer or provider
 */
export abstract class URN {
  public static parse(urn: string): URN {
    const parts = urn.split('::');
    if (parts.length !== 4) {
      throw new Error(`Invalid URN: ${urn}`);
    }
    const typeParts = parts[2].split('$');
    const type = typeParts[typeParts.length - 1];

    const stack = parts[0].split(':')[2];
    const project = parts[1];
    if (!stack || !project || !type) {
      throw new Error(`Invalid URN: ${urn}`);
    }
    const name = parts[3];
    return {
      stack,
      project,
      type,
      name,
      qualifiedTypes: typeParts,
    };
  }

  /**
   * The Stack being deployed into
   */
  public abstract readonly stack: string;
  /**
   * The Project being evaluated
   */
  public abstract readonly project: string;

  /**
   * The current resource's type token
   */
  public abstract readonly type: string;

  /**
   * The human-friendly name identifier assigned by the developer or provider
   */
  public abstract readonly name: string;

  /**
   * The object type's qualified type tokens (including the parent type)
   */
  public abstract readonly qualifiedTypes?: string[];
}
