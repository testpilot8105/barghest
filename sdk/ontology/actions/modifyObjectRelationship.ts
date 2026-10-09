import type {
  ActionDefinition,
  ActionMetadata,
  ActionParam,
  ActionReturnTypeForOptions,
  ApplyActionOptions,
  ApplyBatchActionOptions,
} from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { Relationship } from '../objects/Relationship.js';

export namespace modifyObjectRelationship {
  // Represents the definition of the parameters for the action
  export type ParamsDefinition = {
    objectToModifyParameter: {
      displayName: 'Modify object';
      multiplicity: false;
      nullable: false;
      type: ActionMetadata.DataType.Object<Relationship>;
    };
    reviewNote: {
      displayName: 'Review note';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    status: {
      displayName: 'Status';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
  };

  export interface Params {
    readonly objectToModifyParameter: ActionParam.ObjectType<Relationship>;

    readonly reviewNote?: ActionParam.PrimitiveType<'string'> | null;

    readonly status?: ActionParam.PrimitiveType<'string'> | null;
  }

  // Represents a fqn of the action
  export interface Signatures {
    applyAction<OP extends ApplyActionOptions>(
      args: modifyObjectRelationship.Params,
      options?: OP,
    ): Promise<ActionReturnTypeForOptions<OP>>;

    batchApplyAction<OP extends ApplyBatchActionOptions>(
      args: ReadonlyArray<modifyObjectRelationship.Params>,
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
 * @param {ActionParam.ObjectType<Relationship>} objectToModifyParameter
 * @param {ActionParam.PrimitiveType<"string">} [reviewNote]
 * @param {ActionParam.PrimitiveType<"string">} [status]
 */
export interface modifyObjectRelationship extends ActionDefinition<modifyObjectRelationship.Signatures> {
  __DefinitionMetadata?: {
    apiName: 'modifyObjectRelationship';
    description: '';
    displayName: 'Modify Relationship';
    modifiedEntities: {
      Relationship: {
        created: false;
        modified: true;
      };
    };
    parameters: modifyObjectRelationship.ParamsDefinition;
    rid: 'ri.action.modify-object-relationship';
    status: 'ACTIVE';
    type: 'action';
    unsanitizedApiName: 'modify-object-relationship';

    signatures: modifyObjectRelationship.Signatures;
  };
  apiName: 'modifyObjectRelationship';
  type: 'action';
  unsanitizedApiName: 'modify-object-relationship';
  osdkMetadata: typeof $osdkMetadata;
}

export const modifyObjectRelationship: modifyObjectRelationship = {
  apiName: 'modifyObjectRelationship',
  type: 'action',
  unsanitizedApiName: 'modify-object-relationship',
  osdkMetadata: $osdkMetadata,
};
