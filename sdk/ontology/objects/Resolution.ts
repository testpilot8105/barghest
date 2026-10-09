import type { PropertyDef as $PropertyDef } from '@osdk/client';
import { $osdkMetadata } from '../../OntologyMetadata.js';
import type { $ExpectedClientVersion } from '../../OntologyMetadata.js';
import type {
  PropertyKeys as $PropertyKeys,
  ObjectTypeDefinition as $ObjectTypeDefinition,
  ObjectMetadata as $ObjectMetadata,
} from '@osdk/client';
import type {
  ObjectSet as $ObjectSet,
  Osdk as $Osdk,
  OsdkObject as $OsdkObject,
  PropertyValueWireToClient as $PropType,
  SingleLinkAccessor as $SingleLinkAccessor,
} from '@osdk/client';

export namespace Resolution {
  export type PropertyKeys =
    | 'candidateIds'
    | 'canonicalId'
    | 'canonicalType'
    | 'confidence'
    | 'decidedAt'
    | 'decidedBy'
    | 'decision'
    | 'label'
    | 'method'
    | 'reason'
    | 'resolutionId'
    | 'scenario';

  export type Links = {};

  export interface Props {
    /**
     *   property status: active
     *
     *   display name: 'Candidates'
     */
    readonly candidateIds: $PropType['string'][] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical object'
     */
    readonly canonicalId: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Canonical type'
     */
    readonly canonicalType: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Confidence'
     */
    readonly confidence: $PropType['double'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Decided at'
     */
    readonly decidedAt: $PropType['timestamp'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Decided by'
     */
    readonly decidedBy: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Decision'
     */
    readonly decision: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Label'
     */
    readonly label: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Method'
     */
    readonly method: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Reason'
     */
    readonly reason: $PropType['string'] | undefined;
    /**
     *   property status: active
     *
     *   display name: 'Resolution id'
     */
    readonly resolutionId: $PropType['string'];
    /**
     *   property status: active
     *
     *   display name: 'Investigation'
     */
    readonly scenario: $PropType['string'] | undefined;
  }
  export type StrictProps = Props;

  export interface ObjectSet extends $ObjectSet<Resolution, Resolution.ObjectSet> {}

  export type OsdkInstance<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Resolution.Props = keyof Resolution.Props,
  > = $Osdk.Instance<Resolution, OPTIONS, K>;

  /** @deprecated use OsdkInstance */
  export type OsdkObject<
    OPTIONS extends never | '$rid' = never,
    K extends keyof Resolution.Props = keyof Resolution.Props,
  > = OsdkInstance<OPTIONS, K>;
}

export interface Resolution extends $ObjectTypeDefinition {
  osdkMetadata: typeof $osdkMetadata;
  type: 'object';
  apiName: 'Resolution';
  primaryKeyApiName: 'resolutionId';
  primaryKeyType: 'string';
  __DefinitionMetadata?: {
    objectSet: Resolution.ObjectSet;
    props: Resolution.Props;
    linksType: Resolution.Links;
    strictProps: Resolution.StrictProps;
    apiName: 'Resolution';
    description: undefined;
    displayName: 'Resolution';
    icon: {
      type: 'blueprint';
      color: '#2D72D2';
      name: 'cube';
    };
    implements: [];
    interfaceMap: {};
    inverseInterfaceMap: {};
    links: {};
    pluralDisplayName: 'Resolutions';
    primaryKeyApiName: 'resolutionId';
    primaryKeyType: 'string';
    properties: {
      /**
       *   property status: active
       *
       *   display name: 'Candidates'
       */
      candidateIds: $PropertyDef<'string', 'nullable', 'array'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical object'
       */
      canonicalId: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Canonical type'
       */
      canonicalType: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Confidence'
       */
      confidence: $PropertyDef<'double', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Decided at'
       */
      decidedAt: $PropertyDef<'timestamp', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Decided by'
       */
      decidedBy: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Decision'
       */
      decision: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Label'
       */
      label: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Method'
       */
      method: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Reason'
       */
      reason: $PropertyDef<'string', 'nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Resolution id'
       */
      resolutionId: $PropertyDef<'string', 'non-nullable', 'single'>;
      /**
       *   property status: active
       *
       *   display name: 'Investigation'
       */
      scenario: $PropertyDef<'string', 'nullable', 'single'>;
    };
    rid: 'ri.Resolution';
    status: 'ACTIVE';
    titleProperty: 'label';
    type: 'object';
    visibility: undefined;
  };
}

export const Resolution = {
  type: 'object',
  apiName: 'Resolution',
  osdkMetadata: $osdkMetadata,
  primaryKeyApiName: 'resolutionId',
  primaryKeyType: 'string',
  internalDoNotUseMetadata: {
    rid: 'ri.Resolution',
  },
} satisfies Resolution & { internalDoNotUseMetadata: { rid: string } } as Resolution;
