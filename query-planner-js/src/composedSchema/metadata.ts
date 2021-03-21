import { FieldNode, InlineFragmentNode, GraphQLField, GraphQLObjectType } from 'graphql';
import { MultiMap } from '../utilities/MultiMap';

declare module 'graphql' {
  interface GraphQLSchemaExtensions {
    federation?: FederationSchemaMetadata;
  }

  interface GraphQLObjectTypeExtensions {
    federation?: FederationTypeMetadata;
  }

  interface GraphQLFieldExtensions<
    _TSource,
    _TContext,
    _TArgs = { [argName: string]: any }
  > {
    federation?: FederationFieldMetadata;
  }
}

export function getFederationMetadataForType(
  type: GraphQLObjectType,
): FederationTypeMetadata | undefined {
  return type.extensions?.federation;
}

export function getFederationMetadataForField(
  field: GraphQLField<any, any>,
): FederationFieldMetadata | undefined {
  return field.extensions?.federation;
}

export type ServiceName = string;
export type FieldSet = readonly (FieldNode | InlineFragmentNode)[];

export interface Endpoint {
  serviceName: string;
  url: string;
}

export type GraphMap = { [graphName: string]: Endpoint };
export interface FederationSchemaMetadata {
  graphs: GraphMap;
}
export interface FederationTypeMetadata {
  serviceName?: ServiceName;
  keys?: MultiMap<ServiceName, FieldSet>;
  isValueType: boolean;
}

export interface FederationFieldMetadata {
  serviceName?: ServiceName;
  requires?: FieldSet;
  provides?: FieldSet;
}
