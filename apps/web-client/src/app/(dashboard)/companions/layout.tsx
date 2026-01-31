import { AsyncBoundary } from "@/components/async-boundary";

type Props = {
  children: React.ReactNode;
};

const CompanionsLayout = ({ children }: Props) => {
  return (
    <AsyncBoundary>
      <main className="px-3 lg:px:4">{children}</main>
    </AsyncBoundary>
  );
};

export default CompanionsLayout;
