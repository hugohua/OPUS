export default function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 space-y-6 text-center">
            <div className="space-y-2">
                <h1 className="text-4xl font-serif font-bold text-foreground">Opus</h1>
                <p className="text-muted-foreground">AI Contextual Reader</p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
                <p className="text-sm">Environment Initialized Successfully.</p>
            </div>
        </div>
    );
}
