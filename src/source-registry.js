export const MARKET_FUND_KEYS = [
  'investorDeposit',
  'derivativesDeposit',
  'rpBalance',
  'receivables',
  'forcedSaleAmount',
  'forcedSaleRatio',
];

export const FREESIS = {
  marketFunds: {
    sourceId: 'freesis-market-funds',
    name: 'FreeSIS',
    datasetName: '증시자금추이',
    priority: 0,
    origin: 'KOFIA',
    parentDivId: 'MSIS10000000000000',
    serviceId: 'STATSCU0100000060',
    objectName: 'STATSCU0100000060BO',
    dataUrl: 'https://freesis.kofia.or.kr/meta/getMetaDataList.do',
    pageUrl: 'https://freesis.kofia.or.kr/stat/FreeSIS.do',
    collectionMethod: 'xhr',
    monetaryScale: 1_000_000,
    unit: 'KRW million',
  },
};

export const FSC = {
  marketFunds: {
    sourceId: 'fsc-public-data-market-funds',
    name: 'Financial Services Commission Public Data Portal',
    datasetName: '금융투자협회종합통계정보 · 증시자금추이',
    priority: 1,
    origin: 'KOFIA',
    provider: 'Financial Services Commission',
    datasetId: '15094809',
    dataUrl: 'https://apis.data.go.kr/1160100/service/GetKofiaStatisticsInfoService/getSecuritiesMarketTotalCapitalInfo',
    pageUrl: 'https://www.data.go.kr/data/15094809/openapi.do',
    collectionMethod: 'official-rest-api',
  },
};
