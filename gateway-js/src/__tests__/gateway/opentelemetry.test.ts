import gql from 'graphql-tag';
import {ApolloGateway, LocalGraphQLDataSource} from '../../';
import {fixtures, spanSerializer} from 'apollo-federation-integration-testsuite';
import {InMemorySpanExporter, SimpleSpanProcessor} from '@opentelemetry/tracing'
import {NodeTracerProvider} from '@opentelemetry/node';
import { buildSubgraphSchema } from '@apollo/subgraph';

expect.addSnapshotSerializer(spanSerializer);

const inMemorySpans = new InMemorySpanExporter();
const tracerProvider = new NodeTracerProvider();
tracerProvider.addSpanProcessor(new SimpleSpanProcessor(inMemorySpans));
tracerProvider.register();

beforeEach(() => {
  inMemorySpans.reset();
});

describe('opentelemetry', () => {
  async function execute(executor: any, source: string, variables: any, operationName: string) {
    await executor({
      source,
      document: gql(source),
      request: {
        variables,
      },
      operationName,
      queryHash: 'hashed',
      context: null,
      cache: {} as any,
    });
  }

  describe('with local data', () =>
  {
    async function gateway() {
      const localDataSources = Object.fromEntries(
        fixtures.map((f) => [
          f.name,
          new LocalGraphQLDataSource(buildSubgraphSchema(f)),
        ]),
      );
      const gateway = new ApolloGateway({
        localServiceList: fixtures,
        buildService(service) {
          return localDataSources[service.name];
        },
      });

      const {executor} = await gateway.load();
      return executor;
    }

    it('receives spans on success', async () => {
      const executor = await gateway();

      const source = `#graphql
      query GetProduct($upc: String!) {
        product(upc: $upc) {
          name
        }
      }
    `;

      await execute(executor, source, {upc: '1'}, 'GetProduct');
      const spans = inMemorySpans.getFinishedSpans()
      expect(spans).toMatchSnapshot();
      spans.forEach((span) => {
        expect(span.events).toStrictEqual([])
      })
    });

    it('receives spans on validation failure', async () => {
      const executor = await gateway();
      const source = `#graphql
      query InvalidVariables($first: Int!) {
        topReviews(first: $first) {
          body
        }
      }
    `;

      await execute(executor, source, { upc: '1' }, 'InvalidVariables');
      const spans = inMemorySpans.getFinishedSpans()
      expect(spans).toMatchSnapshot();
      const validationSpan = spans.find((span) =>
        span.name === 'gateway.validate');

      expect(validationSpan?.events.length).toBeGreaterThan(0)
    });

    it('receives spans on plan failure', async () => {
      const executor = await gateway();
      const source = `#graphql
      subscription GetProduct($upc: String!) {
        product(upc: $upc) {
          name
        }
      }
    `;

      try {
        await execute(executor, source, {upc: '1'}, 'GetProduct');
      }
      catch(err) {}
      const spans = inMemorySpans.getFinishedSpans()
      expect(spans).toMatchSnapshot();
      const planSpan = spans.find((span) =>
        span.name === 'gateway.plan');

      expect(planSpan?.events.length).toBeGreaterThan(0)
    });
  });


  it('receives spans on fetch failure', async () => {
    const gateway = new ApolloGateway({
      localServiceList: fixtures,
      fetcher: () => {
        throw Error('Nooo');
      },
    });

    const { executor } = await gateway.load();

    const source = `#graphql
    query GetProduct($upc: String!) {
      product(upc: $upc) {
        name
      }
    }
    `;

    await execute(executor, source, {upc: '1'}, 'GetProduct');
    const spans = inMemorySpans.getFinishedSpans()
    expect(spans).toMatchSnapshot();
    const fetchSpan = spans.find((span) =>
      span.name === 'gateway.fetch');

    expect(fetchSpan?.events.length).toBeGreaterThan(0)
  });
});
