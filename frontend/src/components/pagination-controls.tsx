import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "#/components/ui/button";

type PaginationControlsProps = {
	page: number;
	pages: number;
	onPageChange: (page: number) => void;
};

export function PaginationControls({
	page,
	pages,
	onPageChange,
}: PaginationControlsProps) {
	if (pages <= 1) return null;
	return (
		<nav
			aria-label="Pagination"
			className="flex items-center justify-center gap-3"
		>
			<Button
				variant="outline"
				size="icon-sm"
				disabled={page <= 1}
				onClick={() => onPageChange(page - 1)}
				aria-label="Previous page"
			>
				<ChevronLeft className="size-4" />
			</Button>
			<span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">
				Page {page} of {pages}
			</span>
			<Button
				variant="outline"
				size="icon-sm"
				disabled={page >= pages}
				onClick={() => onPageChange(page + 1)}
				aria-label="Next page"
			>
				<ChevronRight className="size-4" />
			</Button>
		</nav>
	);
}
