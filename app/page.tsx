import Compass from "@/components/Compass";
import PassportBackdrop from "@/components/PassportBackdrop";

export default function Home() {
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-x-clip bg-bg text-fg">
      <PassportBackdrop />
      <Compass />
    </div>
  );
}
