export interface StockByStatus {
  status: string;
  count: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  profit: number;
  units: number;
}

export interface DashboardStats {
  stockByStatus: StockByStatus[];
  monthlySales: { units: number; revenue: number };
  totalCostValue: number;
  monthlyProfit: number;
  monthly: MonthlyData[];
}
