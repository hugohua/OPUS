import { GridBackground } from "@/components/ui/grid-background";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <GridBackground>
            {children}
        </GridBackground>
    );
}
