insert into public.favorite_items (user_id, target_type, target_id)
select user_id, 'question', question_id
from public.saved_questions
on conflict (user_id, target_type, target_id) do nothing;
