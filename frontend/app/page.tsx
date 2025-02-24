export default function WelcomeScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl md:text-3xl font-medium">
          Hi [name], welcome to
        </h1>
        <div className="text-4xl md:text-6xl font-bold space-y-2">
          <div>Innovation</div>
          <div>Workflow</div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <a
            href="/new"
            className="inline-flex items-center justify-center bg-[#0000FF] text-white rounded-[20px] px-8 py-6 text-lg font-medium min-w-[200px]
                     transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            start new
          </a>
          <a
            href="/past"
            className="inline-flex items-center justify-center bg-black text-white rounded-[20px] px-8 py-6 text-lg font-medium min-w-[200px]
                     transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            past project
          </a>
        </div>
      </div>
    </div>
  );
}
