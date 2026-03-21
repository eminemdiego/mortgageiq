export function MortgageReportEmail({ form, analysis }) {
  const { current, rateScenarios, overpaymentScenarios } = analysis;
  const currentYears = (current.totalMonths / 12).toFixed(1);
  const fmt = (n) => "£" + Number(n).toLocaleString("en-GB");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
          .container { max-width: 600px; margin: 0 auto; background: #FAFBFC; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366F1, #4F46E5); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
          .header h1 { margin: 0 0 8px; font-size: 24px; }
          .header p { margin: 0; opacity: 0.9; font-size: 14px; }
          .card { background: white; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
          .card h2 { margin: 0 0 16px; font-size: 18px; color: #111; border-bottom: 2px solid #EEF2FF; padding-bottom: 12px; }
          .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
          .summary-item { background: #F9FAFB; padding: 16px; border-radius: 10px; }
          .summary-label { font-size: 12px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 20px; font-weight: 700; color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #F3F4F6; padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #666; border: 1px solid #E5E7EB; }
          td { padding: 10px 12px; border: 1px solid #E5E7EB; font-size: 14px; }
          tr:nth-child(even) { background: #FAFBFC; }
          .highlight { background: #EEF2FF; }
          .recommendation { background: #ECFDF5; border-left: 4px solid #10B981; padding: 16px; margin: 12px 0; border-radius: 8px; }
          .recommendation-title { font-weight: 600; color: #065F46; margin-bottom: 8px; }
          .recommendation-text { color: #047857; font-size: 14px; }
          .footer { text-align: center; padding-top: 24px; border-top: 1px solid #E5E7EB; color: #999; font-size: 12px; margin-top: 24px; }
          .disclaimer { background: #FEF3C7; border: 1px solid #FCD34D; padding: 16px; border-radius: 10px; margin-top: 16px; font-size: 12px; color: #92400E; }
          strong { color: #111; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Mortgage Analysis Report</h1>
            <p>Generated ${new Date().toLocaleDateString("en-UK", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>

          <!-- Mortgage Summary -->
          <div class="card">
            <h2>Mortgage Summary</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Outstanding Balance</div>
                <div class="summary-value">${fmt(form.outstandingBalance)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Monthly Payment</div>
                <div class="summary-value">${fmt(form.monthlyPayment)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Interest Rate</div>
                <div class="summary-value">${form.interestRate}%</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Remaining Term</div>
                <div class="summary-value">${currentYears} years</div>
              </div>
            </div>
            ${form.bank ? `<p><strong>Lender:</strong> ${form.bank}</p>` : ""}
            ${form.mortgageType ? `<p><strong>Type:</strong> ${form.mortgageType}</p>` : ""}
            ${form.rateType ? `<p><strong>Rate Type:</strong> ${form.rateType}</p>` : ""}
          </div>

          <!-- Interest Cost -->
          <div class="card">
            <h2>Total Interest Cost</h2>
            <p style="margin: 0; font-size: 16px;">At your current rate and payment, you will pay:</p>
            <div style="background: #FEF3C7; padding: 16px; border-radius: 10px; margin-top: 12px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #92400E;">${fmt(current.totalInterest)}</div>
              <div style="font-size: 13px; color: #A16207; margin-top: 4px;">in total interest over ${currentYears} years</div>
            </div>
          </div>

          <!-- Overpayment Strategies -->
          <div class="card">
            <h2>Overpayment Strategies</h2>
            <p style="margin: 0 0 16px; color: #666; font-size: 14px;">Here's how extra monthly payments can save you money:</p>
            <table>
              <thead>
                <tr>
                  <th>Extra/Month</th>
                  <th>New Term</th>
                  <th>Interest Saved</th>
                  <th>Years Saved</th>
                </tr>
              </thead>
              <tbody>
                ${overpaymentScenarios.slice(0, 5).map((s, i) => `
                  <tr ${s.withinLimit ? 'class="highlight"' : ""}>
                    <td><strong>${s.extra}</strong></td>
                    <td>${s.years} years</td>
                    <td style="color: #10B981; font-weight: 600;">${fmt(s.saved)}</td>
                    <td style="color: #6366F1; font-weight: 600;">${s.yearsSaved} years</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <p style="margin: 12px 0 0; font-size: 12px; color: #666;"><strong>Note:</strong> Highlighted rows are within your penalty-free overpayment allowance.</p>
          </div>

          <!-- Rate Scenarios -->
          <div class="card">
            <h2>Rate Change Scenarios</h2>
            <p style="margin: 0 0 16px; color: #666; font-size: 14px;">Impact if interest rates change when your current deal ends:</p>
            <table>
              <thead>
                <tr>
                  <th>Rate</th>
                  <th>Monthly Payment</th>
                  <th>Difference</th>
                  <th>Total Interest</th>
                </tr>
              </thead>
              <tbody>
                ${rateScenarios.slice(0, 7).map((s) => `
                  <tr ${s.rateNum === parseFloat(form.interestRate) ? 'class="highlight"' : ""}>
                    <td><strong>${s.rate}</strong> ${s.rateNum === parseFloat(form.interestRate) ? "(current)" : ""}</td>
                    <td>${fmt(s.monthlyPayment)}</td>
                    <td style="color: ${s.difference > 0 ? "#EF4444" : s.difference < 0 ? "#10B981" : "#666"}; font-weight: 600;">
                      ${s.difference > 0 ? "+" : ""}${fmt(s.difference)}
                    </td>
                    <td>${fmt(s.totalInterest)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <!-- Key Recommendations -->
          <div class="card">
            <h2>Key Recommendations</h2>
            <div class="recommendation">
              <div class="recommendation-title">💡 Maximize Overpayments</div>
              <div class="recommendation-text">Even small extra payments can significantly reduce your interest. Start with what you can afford and increase when possible.</div>
            </div>
            <div class="recommendation">
              <div class="recommendation-title">📅 Plan for Remortgage</div>
              <div class="recommendation-text">If you're on a fixed rate, start shopping for deals 3-6 months before it ends to avoid falling onto a higher SVR.</div>
            </div>
            <div class="recommendation">
              <div class="recommendation-title">🎯 Monitor Your Balance</div>
              <div class="recommendation-text">Track your loan-to-value ratio. As it improves, you may qualify for better rates with a remortgage.</div>
            </div>
          </div>

          <div class="disclaimer">
            <strong>Disclaimer:</strong> This report is for informational purposes only and does not constitute financial advice. All figures are estimates based on the information provided. Actual costs may vary based on your lender's specific terms, fees, and calculation methods. Always consult a qualified mortgage adviser before making changes to your mortgage.
          </div>

          <div class="footer">
            <p>MortgageIQ — AI-Powered Mortgage Analysis</p>
            <p style="margin: 8px 0 0;">This report was generated at ${new Date().toLocaleTimeString("en-GB")}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
