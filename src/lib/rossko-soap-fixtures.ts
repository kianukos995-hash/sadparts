/** Official-shaped SOAP envelopes from api.rossko.ru v2.1 docs / WSDL. */

export const GET_SEARCH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://api.rossko.ru/">
  <SOAP-ENV:Body>
    <ns1:GetSearchResponse>
      <ns1:SearchResult>
        <ns1:success>true</ns1:success>
        <ns1:text>333114</ns1:text>
        <ns1:PartsList>
          <ns1:Part>
            <ns1:guid>NSIN0000086407</ns1:guid>
            <ns1:brand>KYB</ns1:brand>
            <ns1:partnumber>333114</ns1:partnumber>
            <ns1:name>Стойка амортизационная - Excel-G | перед прав |</ns1:name>
            <ns1:stocks>
              <ns1:stock>
                <ns1:id>HST154</ns1:id>
                <ns1:price>2449.85</ns1:price>
                <ns1:count>20</ns1:count>
                <ns1:multiplicity>1</ns1:multiplicity>
                <ns1:type>0</ns1:type>
                <ns1:delivery>0</ns1:delivery>
                <ns1:extra>0</ns1:extra>
                <ns1:description>Новосибирск, ул. Бетонная, 14А</ns1:description>
                <ns1:deliveryStart>2020-01-30T17:00:00</ns1:deliveryStart>
                <ns1:deliveryEnd>2020-01-30T20:00:00</ns1:deliveryEnd>
              </ns1:stock>
              <ns1:stock>
                <ns1:id>HST162</ns1:id>
                <ns1:price>2449.85</ns1:price>
                <ns1:count>50</ns1:count>
                <ns1:multiplicity>1</ns1:multiplicity>
                <ns1:type>0</ns1:type>
                <ns1:delivery>6</ns1:delivery>
                <ns1:extra>0</ns1:extra>
                <ns1:description>Партнерский склад</ns1:description>
              </ns1:stock>
            </ns1:stocks>
            <ns1:crosses>
              <ns1:Part>
                <ns1:guid>NSIN0000034866</ns1:guid>
                <ns1:brand>Sachs</ns1:brand>
                <ns1:partnumber>290074</ns1:partnumber>
                <ns1:name>Амортизатор | перед прав |</ns1:name>
                <ns1:stocks>
                  <ns1:stock>
                    <ns1:id>HST25</ns1:id>
                    <ns1:price>3297.72</ns1:price>
                    <ns1:count>1</ns1:count>
                    <ns1:multiplicity>1</ns1:multiplicity>
                    <ns1:type>0</ns1:type>
                    <ns1:delivery>0</ns1:delivery>
                    <ns1:extra>0</ns1:extra>
                    <ns1:description>Новосибирск, ул. Бетонная, 14А</ns1:description>
                  </ns1:stock>
                </ns1:stocks>
              </ns1:Part>
            </ns1:crosses>
          </ns1:Part>
        </ns1:PartsList>
      </ns1:SearchResult>
    </ns1:GetSearchResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

export const GET_CHECKOUT_DETAILS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://api.rossko.ru/">
  <SOAP-ENV:Body>
    <ns1:GetCheckoutDetailsResponse>
      <ns1:CheckoutDetailsResult>
        <ns1:success>true</ns1:success>
        <ns1:DeliveryType>
          <ns1:delivery><ns1:id>000000001</ns1:id><ns1:name>Самовывоз со склада</ns1:name></ns1:delivery>
          <ns1:delivery><ns1:id>000000002</ns1:id><ns1:name>Курьерская доставка</ns1:name></ns1:delivery>
        </ns1:DeliveryType>
        <ns1:PaymentType>
          <ns1:payment><ns1:id>1</ns1:id><ns1:name>Оплата банковским платежом</ns1:name></ns1:payment>
          <ns1:payment><ns1:id>2</ns1:id><ns1:name>Оплата наличными при получении товара</ns1:name></ns1:payment>
        </ns1:PaymentType>
        <ns1:DeliveryAddress>
          <ns1:address>
            <ns1:id>112233</ns1:id>
            <ns1:city>Новосибирск</ns1:city>
            <ns1:street>Бетонная</ns1:street>
            <ns1:house>14</ns1:house>
            <ns1:office></ns1:office>
            <ns1:Delivery>
              <ns1:ids>
                <ns1:id>000000002</ns1:id>
                <ns1:id>000000003</ns1:id>
                <ns1:id>000000004</ns1:id>
              </ns1:ids>
            </ns1:Delivery>
          </ns1:address>
        </ns1:DeliveryAddress>
        <ns1:CompanyList>
          <ns1:company>
            <ns1:id>112233</ns1:id>
            <ns1:name>ООО "Рога и Копыта"</ns1:name>
            <ns1:requisite>ИНН 0123456789</ns1:requisite>
          </ns1:company>
        </ns1:CompanyList>
      </ns1:CheckoutDetailsResult>
    </ns1:GetCheckoutDetailsResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

export const GET_CHECKOUT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://api.rossko.ru/">
  <SOAP-ENV:Body>
    <ns1:GetCheckoutResponse>
      <ns1:CheckoutResult>
        <ns1:success>true</ns1:success>
        <ns1:OrderIDS>
          <ns1:id>1234567</ns1:id>
        </ns1:OrderIDS>
        <ns1:DeliveryCost>
          <ns1:cost>0</ns1:cost>
        </ns1:DeliveryCost>
        <ns1:ItemsList>
          <ns1:Item>
            <ns1:partnumber>IQ16TT#4</ns1:partnumber>
            <ns1:brand>Denso</ns1:brand>
            <ns1:count>1</ns1:count>
            <ns1:price>363.13</ns1:price>
            <ns1:total_price>363.13</ns1:total_price>
            <ns1:stock>HST123</ns1:stock>
            <ns1:delivery>5</ns1:delivery>
            <ns1:comment>comment</ns1:comment>
            <ns1:order_id>1234567</ns1:order_id>
            <ns1:extra>0</ns1:extra>
            <ns1:description>Москва</ns1:description>
            <ns1:stock_address>Новосибирск, ул. Бетонная, 14А</ns1:stock_address>
          </ns1:Item>
        </ns1:ItemsList>
        <ns1:ItemsErrorList>
          <ns1:ItemError>
            <ns1:partnumber>IQ16TT#4</ns1:partnumber>
            <ns1:brand>Denso</ns1:brand>
            <ns1:count>1</ns1:count>
            <ns1:stock>HST123</ns1:stock>
            <ns1:message>Нет в наличии</ns1:message>
          </ns1:ItemError>
        </ns1:ItemsErrorList>
      </ns1:CheckoutResult>
    </ns1:GetCheckoutResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

export const GET_ORDERS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://api.rossko.ru/">
  <SOAP-ENV:Body>
    <ns1:GetOrdersResponse>
      <ns1:OrdersResult>
        <ns1:success>true</ns1:success>
        <ns1:OrdersList>
          <ns1:Order>
            <ns1:id>1234567</ns1:id>
            <ns1:created_date>01.02.2017 16:15:22</ns1:created_date>
            <ns1:delivery_date>06.02.2017</ns1:delivery_date>
            <ns1:total_price>363.13</ns1:total_price>
            <ns1:extra>0</ns1:extra>
            <ns1:stock_address>Новосибирск, ул. Бетонная, 14А</ns1:stock_address>
            <ns1:detail>
              <ns1:delivery_type>Курьерская доставка</ns1:delivery_type>
              <ns1:delivery_cost>0</ns1:delivery_cost>
              <ns1:delivery_address>Новосибирск, Мира, 14</ns1:delivery_address>
              <ns1:payment_type>Оплата банковским платежом</ns1:payment_type>
              <ns1:company_name>ООО "Рога и Копыта"</ns1:company_name>
              <ns1:company_requisites>ИНН 0123456789</ns1:company_requisites>
            </ns1:detail>
            <ns1:parts>
              <ns1:part>
                <ns1:guid>NSII0009734515</ns1:guid>
                <ns1:partnumber>IQ16TT#4</ns1:partnumber>
                <ns1:name>Свеча зажигания</ns1:name>
                <ns1:brand>Denso</ns1:brand>
                <ns1:price>363.13</ns1:price>
                <ns1:count>1</ns1:count>
                <ns1:delivery>5</ns1:delivery>
                <ns1:comment>Комментарий к строке заказа</ns1:comment>
                <ns1:status>1</ns1:status>
              </ns1:part>
            </ns1:parts>
          </ns1:Order>
        </ns1:OrdersList>
      </ns1:OrdersResult>
    </ns1:GetOrdersResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
