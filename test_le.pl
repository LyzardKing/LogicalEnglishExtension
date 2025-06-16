:- use_module('logicalenglish/prolog/le_answer.pl').
:- set_prolog_flag(color_term, false).

% :- initialization(main, main).

main(R) :-
    protocol('log.txt'),
    read_file_to_string('examples/cittadinanza_ita.le', String, []),
    % parse_and_query_and_explanation_text('dragon', en(String), happy, with(smoky), R).
    parse_and_query_and_explanation_text('cittadinanza_ita', en(String), uno, with(giuseppe), R).

show_prolog(R) :-
    protocol('log.txt'),
    read_file_to_string('examples/cittadinanza_ita.le', String, []),
    % parse_and_query_and_explanation_text('dragon', en(String), happy, with(smoky), R).
    parse_and_query_and_explanation_text('cittadinanza_ita', en(String), uno, with(giuseppe), _),
    with_output_to(string(R), show(prolog)).