declare module 'Evonet' {
  export type Endpoint =
    | 'payment'
    | 'paymentMethod'
    | 'capture'
    | 'refund'
    | 'evo.e-commerce.paymentMethod'
    | 'cancel';
  // | 'evo.e-commerce.paymentMethod'
  export type Method = 'GET' | 'POST' | 'DELETE' | 'PUT';
  export interface AuthorizationParam {
    method: Method;
    url: string;
    body?: any;
  }

  export type Recurrence = 'monthly' | 'quarterly' | 'biannually' | 'yearly';

  export type PaymentStatus =
    | 'Verifying'
    | 'Authorised'
    | 'Cancelled'
    | 'Success'
    | 'Failed'
    | 'Captured'
    | 'Capturing';
  export type Metadata =
    | 'subscription.created'
    | 'subscription.updated'
    | 'subscription.renew'
    | 'subscription.refund'
    | 'create.token';
  export interface TransAmount {
    currency: str;
    value: str;
  }
  export interface NotificationCommon {
    subscription_id: str;
    product_id: str;
    purchaser_id: str;
    product_name: str;
    user_id: str;
    user_email: str;
    purchase_ids: str[];
    created_at: int;
    charge_occurrence_count: int;
    recurrence: Recurrence;
    free_trial_ends_at: int;
    custom_fields: Record<string, any>;
    license_key: str;
    refunded?: boolean;
    variants?: any;
  }

  export interface Variants {
    Tier: string;
  }

  export interface ThreeDSData {
    method: string;
    url: string;
  }

  export interface TypeAction {
    threeDSData: ThreeDSData;
    type: string;
  }

  export interface Authentication {
    type: string;
  }

  export interface Card {
    first6No: string;
    fundingType: string;
    holderName: string;
    issuingCountry: string;
    last4No: string;
    paymentBrand: string;
  }

  export interface MerchantTransInfo {
    merchantOrderReference: string;
    merchantTransID: string;
    merchantTransTime: string;
  }

  export interface PaymentMethod {
    card: Card;
    merchantTransInfo: MerchantTransInfo;
    paymentMethodVariant: string;
    recurringReference: string;
    status?: PaymentStatus;
    token?: Token;
    failureCode?: string;
    failureReason?: string;
  }

  /**
   * @see Doc chapter 8.1 Result code
   */
  export interface ApiResult {
    code: string;
    message: string;
  }

  interface BillingFXRate {
    value: string;
  }

  interface EvoTransInfo {
    evoTransID: string;
    evoTransTime: string;
    retrievalReferenceNum: string;
    traceNum: string;
  }

  interface MerchantTransInfo {
    merchantOrderReference: string;
    merchantTransID: string;
    merchantTransTime: string;
  }

  interface PspTransInfo {
    authorizationCode: string;
    cvcCheckResult: string;
    cvcCheckResultRaw: string;
    pspTransID: string;
    pspTransTime: string;
  }

  export interface NotificationPayment {
    billingAmount: TransAmount;
    billingFXRate: BillingFXRate;
    evoTransInfo: EvoTransInfo;
    merchantTransInfo: MerchantTransInfo;
    pspTransInfo: PspTransInfo;
    status: PaymentStatus;
    transAmount: TransAmount;
    failureCode?: string;
    failureReason?: string;
  }
  export interface TokenPaymentResponsePayment {
    evoTransInfo: EvoTransInfo;
    merchantTransInfo: MerchantTransInfo;
    pspTransInfo: PspTransInfo;
    status: PaymentStatus;
    transAmount: TransAmount;
    recurringReference?: string;
    failureCode?: string;
    failureReason?: string;
  }

  export type NotificationOneKeyPay = TokenPaymentResponse;
  export interface PaymentMethodEncrypted {
    action: TypeAction;
    authentication: Authentication;
    metadata: Metadata;
    paymentMethod: PaymentMethod;
    payment?: NotificationPayment;
    result: ApiResult;
  }

  export interface TokenPaymentResponse {
    metadata: Metadata;
    paymentMethod: PaymentMethod;
    payment: TokenPaymentResponsePayment;
    result: ApiResult;
  }

  export interface MpiData {
    cavv: string;
    dsTransID: string;
    eci: string;
    status: string;
    threeDSVersion: string;
  }

  export interface ThreeD {
    mpiData: MpiData;
  }

  export interface NotificationAuthentication {
    threeDS: ThreeD;
    type: string;
  }

  export interface NotificationPaymentMethod {
    card: Card;
    merchantTransInfo?: MerchantTransInfo;
    recurringReference: string;
    status: PaymentStatus;
    token: Token;
    failureCode?: string;
    failureReason?: string;
  }

  /**
   * card pay
   */
  export interface Notification {
    authentication?: NotificationAuthentication;
    eventCode: string;
    metadata: Metadata;
    payment?: NotificationPayment;
    paymentMethod: NotificationPaymentMethod;
  }

  export interface Token {
    createTime: string;
    fingerprint: string;
    status: string;
    updateTime: string;
    userReference: string;
    value: string;
    vaultID: string;
  }

  export interface PaymentMethodList {
    card: Card;
    token: Token;
  }

  export interface NotificationForRequestToken {
    authentication: Authentication;
    eventCode: string;
    metadata: Metadata;
    paymentMethod: NotificationPaymentMethod;
  }
  export interface UserToken {
    paymentMethodList: PaymentMethodList[];
  }

  export interface PaymentStateResponse {
    metadata?: Metadata;
    paymentMethod: PaymentMethod;
    payment?: TokenPaymentResponsePayment;
    result: ApiResult;
  }

  export type StateResp = {
    date: string;
    reason: string;
    done: boolean;
    isOk: boolean;
  };

  export interface EventEvonetComplete {
    id: number;
    recurringReference?: string;
    remark?: string;
    reason?: string;
  }
}
