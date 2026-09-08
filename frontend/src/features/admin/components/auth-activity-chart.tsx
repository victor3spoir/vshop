import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type AxisOptions, Chart } from "react-charts";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import type {
	AuthStatsPeriod,
	AuthStatsPoint,
} from "#/features/admin/admin.functions";
import { authStatsQueryOptions } from "#/features/admin/admin.queries";

type ChartDatum = { date: Date; count: number };

const PERIODS: { value: AuthStatsPeriod; label: string }[] = [
	{ value: 7, label: "7d" },
	{ value: 30, label: "30d" },
	{ value: 90, label: "90d" },
];

export function AuthActivityChart({
	period,
	onPeriodChange,
}: {
	period: AuthStatsPeriod;
	onPeriodChange: (period: AuthStatsPeriod) => void;
}) {
	const { data: stats } = useSuspenseQuery(authStatsQueryOptions(period));

	const data = useMemo(() => {
		const toDatum = (pick: (p: AuthStatsPoint) => number) =>
			stats.map((p) => ({ date: new Date(p.date), count: pick(p) }));
		return [
			{ label: "Sign-ins", data: toDatum((p) => p.signins) },
			{ label: "Sign-ups", data: toDatum((p) => p.signups) },
		];
	}, [stats]);

	const primaryAxis = useMemo(
		(): AxisOptions<ChartDatum> => ({
			getValue: (datum) => datum.date,
			scaleType: "time",
		}),
		[],
	);

	const secondaryAxes = useMemo(
		(): AxisOptions<ChartDatum>[] => [
			{
				getValue: (datum) => datum.count,
				scaleType: "linear",
				elementType: "line",
				hardMin: 0,
				formatters: { scale: (value: number) => `${Math.round(value ?? 0)}` },
			},
		],
		[],
	);

	const totals = stats.reduce(
		(acc, p) => {
			acc.signins += p.signins;
			acc.signups += p.signups;
			return acc;
		},
		{ signins: 0, signups: 0 },
	);

	return (
		<section className="rounded-lg border">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
				<div>
					<h2 className="text-sm font-semibold">Auth activity</h2>
					<p className="text-xs text-muted-foreground">
						{totals.signins} sign-ins, {totals.signups} sign-ups in the last{" "}
						{period} days
					</p>
				</div>
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					value={String(period)}
					onValueChange={(value) => {
						if (value) onPeriodChange(Number(value) as AuthStatsPeriod);
					}}
				>
					{PERIODS.map((p) => (
						<ToggleGroupItem key={p.value} value={String(p.value)}>
							{p.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			</header>
			<div className="h-64 w-full p-4">
				<Chart
					options={{
						data,
						primaryAxis,
						secondaryAxes,
						initialWidth: 800,
						initialHeight: 224,
						tooltip: true,
					}}
				/>
			</div>
		</section>
	);
}
