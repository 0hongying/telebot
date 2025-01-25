import { AxiosResponse } from "axios";

export interface ChatResult {
    apiKey: string,
    response: AxiosResponse<any, any>
}