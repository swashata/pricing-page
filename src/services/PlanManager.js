import {BillingCycle, Pricing} from "../entities/Pricing";

let _instance                 = null,
    allPlansPricingCollection = [];

function getPricingSortedByLicensesAsc(plans) {
    let pricingCollection = [];

    for (let plan of plans) {
        if (plan.pricing) {
            pricingCollection = pricingCollection.concat(plan.pricing);
        }
    }

    if (pricingCollection.length > 0) {
        for (let key in pricingCollection) {
            if ( ! pricingCollection.hasOwnProperty(key)) {
                continue;
            }

            pricingCollection[key] = new Pricing(pricingCollection[key]);
        }

        sortPricingByLicensesAsc(pricingCollection);
    }

    return pricingCollection;
}

function sortPricingByLicensesAsc(allPlansPricingCollection) {
    allPlansPricingCollection.sort(function(pricingA, pricingB) {
        if (pricingA.licenses == pricingB.licenses) {
            return 0;
        }

        if (pricingB.isUnlimited() || ( ! pricingA.isUnlimited() && pricingA.licenses < pricingB.licenses)) {
            return -1;
        }

        if (pricingA.isUnlimited() || ( ! pricingB.isUnlimited() && pricingA.licenses > pricingB.licenses)) {
            return 1;
        }
    });
}

function getInstance(plans) {
    if (null !== _instance) {
        return _instance;
    }

    allPlansPricingCollection = getPricingSortedByLicensesAsc(plans);

    _instance = {
        calculateMultiSiteDiscount: function(pricing, billingCycle) {
            if (pricing.isUnlimited() || 1 == pricing.licenses) {
                return .0;
            }

            let
                billingCycleInMonths    = ('lifetime' === billingCycle ?
                        BillingCycle.LIFETIME :
                        ('annual' === billingCycle ?
                            BillingCycle.ANNUAL :
                            BillingCycle.MONTHLY)),
                singleSitePrice         = 0,
                pricingBillingFrequency = billingCycleInMonths,
                price                   = pricing[billingCycle + '_price'];

            if ( ! pricing.hasMonthlyPrice() || BillingCycle.ANNUAL !== billingCycleInMonths) {
                singleSitePrice = this.tryCalcSingleSitePrice(pricing, billingCycleInMonths);
            } else {
                price = pricing.getMonthlyAmount(billingCycleInMonths);

                singleSitePrice         = (this.tryCalcSingleSitePrice(pricing, BillingCycle.ANNUAL) / 12);
                pricingBillingFrequency = BillingCycle.MONTHLY;
            }

            return Math.floor(100 * (
                ((singleSitePrice * pricing.licenses) - price) /
                (
                    this.tryCalcSingleSitePrice(
                        pricing,
                        pricingBillingFrequency
                    ) * pricing.licenses
                )
            ));
        },
        tryCalcSingleSitePrice: function (
            pricing,
            billingCycle,
            format
        ) {
            return this.tryCalcSingleSitePrices(
                pricing,
                billingCycle,
                format
            );
        },
        tryCalcSingleSitePrices: function (pricing, billingCycle, format) {
            return (BillingCycle.LIFETIME !== billingCycle) ?
                this.tryCalcSingleSiteSubscriptionPrice(pricing, billingCycle, format) :
                this.tryCalcSingleSiteLifetimePrice(pricing, format);
        },
        tryCalcSingleSiteSubscriptionPrice(pricing, billingCycle, format) {
            let isMonthly = (BillingCycle.MONTHLY === billingCycle),
                amount    = .0;

            for (let _pricing of allPlansPricingCollection) {
                if (pricing.plan_id !== _pricing.plan_id) {
                    continue;
                }

                if (pricing.currency !== _pricing.currency) {
                    continue;
                }

                if ( ! _pricing.hasMonthlyPrice() && ! _pricing.hasAnnualPrice()) {
                    continue;
                }

                if (isMonthly) {
                    amount = _pricing.getMonthlyAmount(billingCycle);
                } else {
                    amount = (_pricing.hasAnnualPrice() ?
                        parseFloat(_pricing.annual_price) :
                        _pricing.monthly_price * 12.0);
                }

                if ( ! pricing.isUnlimited() && ! _pricing.isUnlimited() && _pricing.licenses > 1)
                    amount /= _pricing.licenses;

                if (format)
                    amount = amount.toFixed(2);

                break;
            }

            return amount;
        },
        tryCalcSingleSiteLifetimePrice(pricing, format) {
            let amount = .0;

            for (let _pricing of allPlansPricingCollection) {
                if (pricing.plan_id !== _pricing.plan_id) {
                    continue;
                }

                if (pricing.currency !== _pricing.currency) {
                    continue;
                }

                amount = _pricing.getAmount(BillingCycle.LIFETIME);

                if ( ! _pricing.isUnlimited() && _pricing.licenses > 1)
                    amount /= _pricing.licenses;

                if (format)
                    amount = amount.toFixed(2);

                break;
            }

            return amount;
        },
        annualDiscountPercentage(pricing) {
            return Math.round(
                this.annualSavings(pricing) / (pricing.getMonthlyAmount(BillingCycle.MONTHLY) * 12 * (pricing.isUnlimited() ? 1 : pricing.licenses)) * 100
            );
        },
        annualSavings(pricing) {
            let annualDiscount = 0;

            if (pricing.isUnlimited()) {
                annualDiscount = ((pricing.getMonthlyAmount(BillingCycle.MONTHLY) * 12) - this.annual_price);
            } else {
                let singleSiteMonthlyPrice = this.tryCalcSingleSitePrice(pricing, BillingCycle.MONTHLY, false);

                if (singleSiteMonthlyPrice > 0) {
                    let singleSiteAnnualPrice = this.tryCalcSingleSitePrice(pricing, BillingCycle.ANNUAL, false);

                    annualDiscount = ((singleSiteMonthlyPrice * 12) - singleSiteAnnualPrice)
                        * pricing.licenses;
                }
            }

            return Math.max(annualDiscount, 0);
        },
        largestAnnualDiscount(planSingleSitePricingCollection) {
            let bestDiscount = 0;

            for (let pricing of planSingleSitePricingCollection) {
                if ( ! pricing.isSingleSite()) {
                    continue;
                }

                bestDiscount = Math.max(bestDiscount, this.annualDiscountPercentage(pricing));
            }

            return Math.round(bestDiscount);
        },
        getSingleSitePricing(pricingCollection, currency) {
            let total = pricingCollection.length;

            if (!pricingCollection || 0 === total) {
                return false;
            }

            for (let i = 0; i < total; i++) {
                let pricing = pricingCollection[i];

                if (currency !== pricing.currency) {
                    continue;
                }

                if (pricing.isSingleSite()) {
                    return pricing;
                }
            }

            return null;
        },
        isFreePlan(pricingCollection) {
            let total = pricingCollection.length;

            if (!pricingCollection || 0 === total) {
                return true;
            }

            for (let i = 0; i < total; i++) {
                let pricing = pricingCollection[i];
                if (!pricing.isFree()) {
                    return false;
                }
            }

            return true;
        },
        isPaidPlan(pricingCollection) {
            return (!this.isFreePlan(pricingCollection));
        }
    };

    return _instance;
}

export const PlanManager = {
    getInstance: function(plans) {
        return getInstance(plans);
    }
};