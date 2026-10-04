import Image from "next/image";

export default function PageHero({
  title,
  kicker,
  sub,
  image,
}: {
  title: string;
  kicker: string;
  sub?: string;
  image?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-brand pb-20 pt-40">
      {image && (
        <>
          <Image
            src={image}
            alt=""
            fill
            priority
            className="object-cover"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-r from-plum-800/85 via-plum-700/55 to-plum-600/10" />
        </>
      )}
      <div className="relative mx-auto max-w-7xl px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
          {kicker}
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] text-white sm:text-6xl">
          {title}
        </h1>
        {sub && (
          <p className="mt-5 max-w-2xl text-lg leading-8 text-mist-100/85">
            {sub}
          </p>
        )}
      </div>
    </section>
  );
}
