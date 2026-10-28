
export const growth = (current, prior) => prior > 0 ? (current / prior - 1) * 100 : null;
export function financialMetrics(data, price = data.quote.close) {
  const a = data.annual.current, b = data.annual.prior, q = data.quarter.current, p = data.quarter.prior;
  const shares = a.shareCapital / 10;
  const ttmEps = a.eps + q.eps - p.eps;
  const afterCapex = a.cfo - a.cashCapex;
  const afterInterest = afterCapex - a.interestPaid;
  return {shares, ttmEps, revenueGrowth:growth(a.revenue,b.revenue), profitGrowth:growth(a.ownerProfit,b.ownerProfit),
    quarterProfitGrowth:growth(q.ownerProfit,p.ownerProfit), quarterRevenueGrowth:growth(q.revenue,p.revenue),
    cfoGrowth:growth(a.cfo,b.cfo), cashConversion:a.cfo/a.groupProfit, afterCapex, afterInterest,
    afterDividends:afterInterest-a.dividendsPaid, debtGrowth:growth(a.borrowings,b.borrowings),
    juneDebtGrowth:growth(q.borrowings,p.borrowings), netDebt:a.borrowings+a.leases-a.cash,
    bookValue:a.ownerEquity/shares, pe:price>0?price/ttmEps:null,
    priceBook:price>0?price/(a.ownerEquity/shares):null, dividendYield:price>0?a.dividend/price*100:null};
}
export function valuationScenario(ttmEps, price, haircut, multiple, margin) {
  if (![ttmEps,price,haircut,multiple,margin].every(Number.isFinite) || ttmEps<=0 || price<=0 || haircut<0 || haircut>=100 || multiple<=0 || margin<0 || margin>=100) return null;
  const eps=ttmEps*(1-haircut/100), value=eps*multiple, entry=value*(1-margin/100);
  return {eps,value,entry,upside:(value/price-1)*100,passes:price<=entry};
}
