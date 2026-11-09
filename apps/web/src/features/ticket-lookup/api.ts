import { createApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
export function ticketLookupApi(baseUrl:string) {
  const client=createApiClient(baseUrl,15000);
  return {
    async raffles(page:number) {
      const {data}=await client.GET('/api/v1/ticket-lookup/raffles',{params:{query:{page,pageSize:12}}});
      if(!data)throw new ApiError('INVALID_RESPONSE',502);
      return data;
    },
    async search(raffleId:string,phone:string,page=1) {
      const {data}=await client.POST('/api/v1/ticket-lookup/search',{
        params:{query:{page,pageSize:12},header:{Origin:window.location.origin}},body:{raffleId,phone},
      });
      if(!data)throw new ApiError('INVALID_RESPONSE',502);
      return data;
    },
  };
}
