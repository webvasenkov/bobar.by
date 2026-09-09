"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { questions } from "@/lib/content";

export function Faq() {
  return (
    <section className="faq container section" aria-labelledby="faq-title">
      <h2 id="faq-title">Пара вопросов</h2>
      <Accordion type="single" collapsible>
        {questions.map(([question, answer], index) => (
          <AccordionItem value={String(index)} key={question}>
            <AccordionTrigger className="faq-question">
              {question}
            </AccordionTrigger>
            <AccordionContent className="faq-answer">{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
