import type {
  ActionDefinition,
  ActionMetadata,
  ActionParam,
  ActionReturnTypeForOptions,
  ApplyActionOptions,
  ApplyBatchActionOptions,
} from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';

export namespace createObjectPerson {
  // Represents the definition of the parameters for the action
  export type ParamsDefinition = {
    aliases: {
      displayName: 'Aliases';
      multiplicity: true;
      nullable: true;
      type: 'string';
    };
    canonicalId: {
      displayName: 'Canonical object';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    fullName: {
      displayName: 'Full name';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    passageId: {
      displayName: 'Passage';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    personId: {
      displayName: 'Person id';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    recordId: {
      displayName: 'Source record';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    role: {
      displayName: 'Role';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    scenario: {
      displayName: 'Scenario';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    schoolId: {
      displayName: 'School';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
  };

  export interface Params {
    readonly aliases?: ReadonlyArray<ActionParam.PrimitiveType<'string'>> | null;

    readonly canonicalId?: ActionParam.PrimitiveType<'string'> | null;

    readonly fullName?: ActionParam.PrimitiveType<'string'> | null;

    readonly passageId?: ActionParam.PrimitiveType<'string'> | null;

    readonly personId?: ActionParam.PrimitiveType<'string'> | null;

    readonly recordId?: ActionParam.PrimitiveType<'string'> | null;

    readonly role?: ActionParam.PrimitiveType<'string'> | null;

    readonly scenario?: ActionParam.PrimitiveType<'string'> | null;

    readonly schoolId?: ActionParam.PrimitiveType<'string'> | null;
  }

  // Represents a fqn of the action
  export interface Signatures {
    applyAction<OP extends ApplyActionOptions>(
      args: createObjectPerson.Params,
      options?: OP,
    ): Promise<ActionReturnTypeForOptions<OP>>;

    batchApplyAction<OP extends ApplyBatchActionOptions>(
      args: ReadonlyArray<createObjectPerson.Params>,
      options?: OP,
    ): Promise<ActionReturnTypeForOptions<OP>>;
  }
}

/**
 *
 *
 * **Note on null values:** _For optional parameters, explicitly providing a null value instead of undefined
 * can change the behavior of the applied action. If prefills are configured, null prevents them
 * from being applied. If a parameter modifies an object's property, null will clear the data from
 * the object, whereas undefined would not modify that property._
 * @param {ActionParam.PrimitiveType<"string">} [aliases]
 * @param {ActionParam.PrimitiveType<"string">} [canonicalId]
 * @param {ActionParam.PrimitiveType<"string">} [fullName]
 * @param {ActionParam.PrimitiveType<"string">} [passageId]
 * @param {ActionParam.PrimitiveType<"string">} [personId]
 * @param {ActionParam.PrimitiveType<"string">} [recordId]
 * @param {ActionParam.PrimitiveType<"string">} [role]
 * @param {ActionParam.PrimitiveType<"string">} [scenario]
 * @param {ActionParam.PrimitiveType<"string">} [schoolId]
 */
export interface createObjectPerson extends ActionDefinition<createObjectPerson.Signatures> {
  __DefinitionMetadata?: {
    apiName: 'createObjectPerson';
    description: '';
    displayName: 'Create Person';
    modifiedEntities: {
      Person: {
        created: true;
        modified: false;
      };
    };
    parameters: createObjectPerson.ParamsDefinition;
    rid: 'ri.action.create-object-person';
    status: 'ACTIVE';
    type: 'action';
    unsanitizedApiName: 'create-object-person';

    signatures: createObjectPerson.Signatures;
  };
  apiName: 'createObjectPerson';
  type: 'action';
  unsanitizedApiName: 'create-object-person';
  osdkMetadata: typeof $osdkMetadata;
}

export const createObjectPerson: createObjectPerson = {
  apiName: 'createObjectPerson',
  type: 'action',
  unsanitizedApiName: 'create-object-person',
  osdkMetadata: $osdkMetadata,
};
