import type {
  ActionDefinition,
  ActionMetadata,
  ActionParam,
  ActionReturnTypeForOptions,
  ApplyActionOptions,
  ApplyBatchActionOptions,
} from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';

export namespace createObjectResolution {
  // Represents the definition of the parameters for the action
  export type ParamsDefinition = {
    candidateIds: {
      displayName: 'Candidates';
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
    canonicalType: {
      displayName: 'Canonical type';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    confidence: {
      displayName: 'Confidence';
      multiplicity: false;
      nullable: true;
      type: 'double';
    };
    decidedAt: {
      displayName: 'Decided at';
      multiplicity: false;
      nullable: true;
      type: 'timestamp';
    };
    decidedBy: {
      displayName: 'Decided by';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    decision: {
      displayName: 'Decision';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    label: {
      displayName: 'Label';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    method: {
      displayName: 'Method';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    reason: {
      displayName: 'Reason';
      multiplicity: false;
      nullable: true;
      type: 'string';
    };
    resolutionId: {
      displayName: 'Resolution id';
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
  };

  export interface Params {
    readonly candidateIds?: ReadonlyArray<ActionParam.PrimitiveType<'string'>> | null;

    readonly canonicalId?: ActionParam.PrimitiveType<'string'> | null;

    readonly canonicalType?: ActionParam.PrimitiveType<'string'> | null;

    readonly confidence?: ActionParam.PrimitiveType<'double'> | null;

    readonly decidedAt?: ActionParam.PrimitiveType<'timestamp'> | null;

    readonly decidedBy?: ActionParam.PrimitiveType<'string'> | null;

    readonly decision?: ActionParam.PrimitiveType<'string'> | null;

    readonly label?: ActionParam.PrimitiveType<'string'> | null;

    readonly method?: ActionParam.PrimitiveType<'string'> | null;

    readonly reason?: ActionParam.PrimitiveType<'string'> | null;

    readonly resolutionId?: ActionParam.PrimitiveType<'string'> | null;

    readonly scenario?: ActionParam.PrimitiveType<'string'> | null;
  }

  // Represents a fqn of the action
  export interface Signatures {
    applyAction<OP extends ApplyActionOptions>(
      args: createObjectResolution.Params,
      options?: OP,
    ): Promise<ActionReturnTypeForOptions<OP>>;

    batchApplyAction<OP extends ApplyBatchActionOptions>(
      args: ReadonlyArray<createObjectResolution.Params>,
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
 * @param {ActionParam.PrimitiveType<"string">} [candidateIds]
 * @param {ActionParam.PrimitiveType<"string">} [canonicalId]
 * @param {ActionParam.PrimitiveType<"string">} [canonicalType]
 * @param {ActionParam.PrimitiveType<"double">} [confidence]
 * @param {ActionParam.PrimitiveType<"timestamp">} [decidedAt]
 * @param {ActionParam.PrimitiveType<"string">} [decidedBy]
 * @param {ActionParam.PrimitiveType<"string">} [decision]
 * @param {ActionParam.PrimitiveType<"string">} [label]
 * @param {ActionParam.PrimitiveType<"string">} [method]
 * @param {ActionParam.PrimitiveType<"string">} [reason]
 * @param {ActionParam.PrimitiveType<"string">} [resolutionId]
 * @param {ActionParam.PrimitiveType<"string">} [scenario]
 */
export interface createObjectResolution extends ActionDefinition<createObjectResolution.Signatures> {
  __DefinitionMetadata?: {
    apiName: 'createObjectResolution';
    description: '';
    displayName: 'Create Resolution';
    modifiedEntities: {
      Resolution: {
        created: true;
        modified: false;
      };
    };
    parameters: createObjectResolution.ParamsDefinition;
    rid: 'ri.action.create-object-resolution';
    status: 'ACTIVE';
    type: 'action';
    unsanitizedApiName: 'create-object-resolution';

    signatures: createObjectResolution.Signatures;
  };
  apiName: 'createObjectResolution';
  type: 'action';
  unsanitizedApiName: 'create-object-resolution';
  osdkMetadata: typeof $osdkMetadata;
}

export const createObjectResolution: createObjectResolution = {
  apiName: 'createObjectResolution',
  type: 'action',
  unsanitizedApiName: 'create-object-resolution',
  osdkMetadata: $osdkMetadata,
};
