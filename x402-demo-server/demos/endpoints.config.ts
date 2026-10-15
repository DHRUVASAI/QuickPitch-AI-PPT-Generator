import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402/avm';
import { declareDiscoveryExtension } from '@x402-avm/extensions';

export interface EndpointConfig {
  [key: string]: {
    accepts: Array<{
      scheme: 'exact';
      price: string;
      network: string;
      payTo: string;
      extra: { asset: number };
    }>;
    description: string;
    extensions?: Record<string, unknown>;
  };
}

export function createPaymentConfig(avmAddress: string): EndpointConfig {
  return {
    'POST /generate-ppt': {
      accepts: [
        {
          scheme: 'exact',
          price: '$0.10',
          network: ALGORAND_TESTNET_CAIP2,
          payTo: avmAddress,
          extra: { asset: Number(USDC_TESTNET_ASA_ID) },
        },
      ],
      description: 'QuickPitch AI Generator - Pay $0.1 USDC per presentation',
      extensions: declareDiscoveryExtension({
        bodyType: 'json',
        input: { source_type: 'youtube', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
        inputSchema: {
          properties: {
            source_type: { type: 'string' },
            url: { type: 'string' },
          },
          required: ['source_type', 'url'],
        },
        output: {
          example: {
            message: 'Returns a binary .pptx file'
          },
        },
      }),
    }
  };
}

export default createPaymentConfig;
